import { defineConfig } from "drizzle-kit";

// Local SQLite (better-sqlite3) — no Cloudflare D1. The database file lives in
// ./data so it can be bind-mounted as a Docker volume and survive rebuilds.
export default defineConfig({
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/app.db",
  },
});
