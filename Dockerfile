FROM node:20-bullseye-slim

WORKDIR /app

# Install tools needed by npm postinstall and runtime curl fallback.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates tar gzip && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
COPY scripts/ scripts/
RUN npm ci

COPY web/package*.json web/
RUN cd web && npm ci

COPY . .
RUN npm run build --if-present

# Zeabur routes traffic to the service port; keep this fixed for the current service.
ENV PORT=8880
ENV NODE_ENV=production
EXPOSE 8880

CMD ["npm", "start"]
