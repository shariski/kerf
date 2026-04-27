# kerf — production image.
#
# Multi-stage so devDependencies (vite, biome, drizzle-kit, etc.)
# never reach the runtime image. The runtime stage carries only:
#   - node 22 alpine
#   - production node_modules (`pnpm install --prod`)
#   - dist/ (built by `pnpm build`)
#   - scripts/serve.mjs (the Node entrypoint)
#   - package.json (so pnpm/node can resolve "type":"module")
#
# Pinned pnpm version comes from package.json's `packageManager`
# field — corepack reads it automatically when enabled.
#
# Plain Dockerfile syntax (no BuildKit-only features) so this builds
# under both `docker build` and `docker buildx build` without
# requiring buildx to be installed.

# ─────────────────────────────────────────────────────────────────
# 1) prod-deps — runtime node_modules only
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ─────────────────────────────────────────────────────────────────
# 2) deps — full deps (incl. dev) for the build
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────
# 3) build — compile the SSR bundle + client bundle
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ─────────────────────────────────────────────────────────────────
# 4) runtime — minimal image, non-root
# ─────────────────────────────────────────────────────────────────
# Carries the compiled app, the runtime entrypoint, AND the migration
# files + runner script. The migrate one-shot reuses this same image
# (see docker-compose.prod.yml) so production never needs drizzle-kit
# or a source tree on the VPS. Migration SQL totals ~10 KB — free.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S kerf && adduser -S kerf -G kerf
COPY --from=prod-deps --chown=kerf:kerf /app/node_modules ./node_modules
COPY --from=build --chown=kerf:kerf /app/dist ./dist
COPY --from=build --chown=kerf:kerf /app/scripts/serve.mjs ./scripts/serve.mjs
COPY --from=build --chown=kerf:kerf /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=kerf:kerf /app/src/server/db/migrations ./drizzle/migrations
COPY --from=build --chown=kerf:kerf /app/package.json ./
USER kerf
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
