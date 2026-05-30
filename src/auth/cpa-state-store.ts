import { randomBytes } from "crypto";

export interface CpaOAuthStateContext {
  provider: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
  expiresAt: number;
  requestId?: string;
  clientId?: string;
  accountHint?: string;
}

export interface CpaOAuthStateStore {
  create(input: {
    provider: string;
    codeVerifier: string;
    redirectUri: string;
    ttlMs?: number;
    requestId?: string;
    clientId?: string;
    accountHint?: string;
  }): Promise<CpaOAuthStateContext>;
  get(state: string): Promise<CpaOAuthStateContext | null>;
  consume(state: string): Promise<CpaOAuthStateContext | null>;
  delete(state: string): Promise<void>;
  cleanupExpired(now?: number): Promise<number>;
  size?(): Promise<number>;
}

export const CPA_OAUTH_STATE_TTL_MS = Number.parseInt(
  process.env.CPA_OAUTH_STATE_TTL_MS || "1800000",
  10,
); // default 30 minutes for debugging headroom

function nowMs(): number {
  return Date.now();
}

function newState(): string {
  return randomBytes(32).toString("base64url");
}

export class MemoryCpaOAuthStateStore implements CpaOAuthStateStore {
  private readonly states = new Map<string, CpaOAuthStateContext>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly defaultTtlMs = CPA_OAUTH_STATE_TTL_MS,
    cleanupIntervalMs = 60_000,
  ) {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired().catch((err) => {
        console.warn("[CPA OAuth state] cleanup failed:", err instanceof Error ? err.message : err);
      });
    }, cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  async create(input: {
    provider: string;
    codeVerifier: string;
    redirectUri: string;
    ttlMs?: number;
    requestId?: string;
    clientId?: string;
    accountHint?: string;
  }): Promise<CpaOAuthStateContext> {
    const createdAt = nowMs();
    const ttlMs = input.ttlMs ?? this.defaultTtlMs;
    let state = newState();
    while (this.states.has(state)) state = newState();
    const ctx: CpaOAuthStateContext = {
      provider: input.provider,
      state,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri,
      createdAt,
      expiresAt: createdAt + ttlMs,
      requestId: input.requestId,
      clientId: input.clientId,
      accountHint: input.accountHint,
    };
    this.states.set(state, ctx);
    return ctx;
  }

  async get(state: string): Promise<CpaOAuthStateContext | null> {
    const ctx = this.states.get(state);
    if (!ctx) return null;
    if (ctx.expiresAt <= nowMs()) {
      this.states.delete(state);
      return null;
    }
    return ctx;
  }

  async consume(state: string): Promise<CpaOAuthStateContext | null> {
    const ctx = await this.get(state);
    if (!ctx) return null;
    this.states.delete(state);
    return ctx;
  }

  async delete(state: string): Promise<void> {
    this.states.delete(state);
  }

  async cleanupExpired(now = nowMs()): Promise<number> {
    let deleted = 0;
    for (const [state, ctx] of this.states) {
      if (ctx.expiresAt <= now) {
        this.states.delete(state);
        deleted += 1;
      }
    }
    return deleted;
  }

  async size(): Promise<number> {
    await this.cleanupExpired();
    return this.states.size;
  }

  destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    this.states.clear();
  }
}

/**
 * Placeholder seam for multi-instance deployments.
 *
 * Use Redis (or another shared KV) for Zeabur/PM2/Node cluster deployments so
 * callbacks routed to a different worker can still resolve the state created by
 * /v0/management/codex-auth-url. Implement the same create/get/consume/delete
 * contract; consume must be atomic (GETDEL or Lua script) to prevent double use.
 */
export function createCpaOAuthStateStore(): CpaOAuthStateStore {
  if (process.env.REDIS_URL || process.env.CPA_STATE_REDIS_URL) {
    console.warn(
      "[CPA OAuth state] REDIS_URL/CPA_STATE_REDIS_URL is set, but Redis state store is not bundled in this build; " +
      "using in-memory store. Do not run multiple instances until RedisCpaOAuthStateStore is wired.",
    );
  }
  return new MemoryCpaOAuthStateStore();
}
