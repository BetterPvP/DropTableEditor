# syntax=docker/dockerfile:1

# ── Base ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies (all, incl. dev — needed to build and to run db scripts) ──
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build the Next.js app (standalone output) ──────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ── Migration / seed / bootstrap runner ────────────────────────────────────
# Has full node_modules + the SQL + the scripts. Used as a one-shot container.
FROM deps AS migrate
COPY scripts ./scripts
COPY db ./db
CMD ["sh", "-c", "npm run db:apply && npm run db:seed-manifest && npm run db:bootstrap"]

# ── Production runtime (minimal, from Next standalone trace) ────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Run as the non-root user that ships with the node image.
USER node
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
