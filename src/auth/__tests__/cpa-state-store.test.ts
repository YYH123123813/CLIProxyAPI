import { describe, expect, it } from "vitest";
import { MemoryCpaOAuthStateStore } from "../cpa-state-store.js";

describe("MemoryCpaOAuthStateStore", () => {
  it("generates unique states and stores every context", async () => {
    const store = new MemoryCpaOAuthStateStore(30 * 60_000, 60_000);
    const contexts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.create({
          provider: "codex",
          codeVerifier: `verifier-${i}`,
          redirectUri: "http://localhost:1455/auth/callback",
          requestId: `req-${i}`,
        }),
      ),
    );

    const states = contexts.map((ctx) => ctx.state);
    expect(new Set(states).size).toBe(10);
    await Promise.all(states.map(async (state, i) => {
      const stored = await store.get(state);
      expect(stored?.codeVerifier).toBe(`verifier-${i}`);
    }));
    expect(await store.size?.()).toBe(10);
    store.destroy();
  });

  it("finds callbacks by their own state when submitted out of order", async () => {
    const store = new MemoryCpaOAuthStateStore(30 * 60_000, 60_000);
    const contexts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.create({
          provider: "codex",
          codeVerifier: `verifier-${i}`,
          redirectUri: "http://localhost:1455/auth/callback",
        }),
      ),
    );

    const shuffled = [...contexts].reverse();
    for (const ctx of shuffled) {
      const found = await store.consume(ctx.state);
      expect(found?.state).toBe(ctx.state);
      expect(found?.codeVerifier).toBe(ctx.codeVerifier);
    }
    expect(await store.size?.()).toBe(0);
    store.destroy();
  });

  it("does not allow the same state to be consumed twice", async () => {
    const store = new MemoryCpaOAuthStateStore(30 * 60_000, 60_000);
    const ctx = await store.create({
      provider: "codex",
      codeVerifier: "verifier",
      redirectUri: "http://localhost:1455/auth/callback",
    });

    expect(await store.consume(ctx.state)).not.toBeNull();
    expect(await store.consume(ctx.state)).toBeNull();
    store.destroy();
  });

  it("returns null and removes state after TTL expiry", async () => {
    const store = new MemoryCpaOAuthStateStore(10, 60_000);
    const ctx = await store.create({
      provider: "codex",
      codeVerifier: "verifier",
      redirectUri: "http://localhost:1455/auth/callback",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await store.consume(ctx.state)).toBeNull();
    expect(await store.size?.()).toBe(0);
    store.destroy();
  });
});
