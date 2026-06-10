# Mobile web companion — Next.js, self-hosted next to the voice backend.
# better-sqlite3 is a native addon, so the build stage needs a toolchain.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Build tools for better-sqlite3 (node-gyp).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate SQL migrations from the schema, then build.
RUN npx drizzle-kit generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/app.db
# Runtime needs node_modules (better-sqlite3 native binary + next start).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs

# data/ holds the SQLite file — mounted as a volume in compose.
RUN mkdir -p /app/data
EXPOSE 3000

# Apply migrations, then serve.
CMD ["sh", "-c", "node src/db/migrate.mjs && npm run start"]
