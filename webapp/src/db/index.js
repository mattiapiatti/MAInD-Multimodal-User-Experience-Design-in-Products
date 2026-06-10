import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import * as schema from "./schema";

export { schema };

// Single process-wide connection. Unlike Cloudflare D1 (per-request binding),
// a self-hosted SQLite file is opened once and shared. We memoize on a module
// global so Next's dev hot-reload doesn't open a new handle every reload.
const DB_PATH = resolve(process.env.DATABASE_PATH || "./data/app.db");

/** @type {ReturnType<typeof drizzle> | undefined} */
let _db = globalThis.__voicebotDb;

const MIGRATIONS_DIR = resolve("./src/db/migrations");

function createDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  // Auto-apply pending migrations on first connect so `next dev` / `next start`
  // work without a manual `db:migrate` step. Idempotent; skipped if the
  // migrations folder is absent (e.g. before `db:generate` has ever run).
  if (existsSync(MIGRATIONS_DIR)) {
    try {
      migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    } catch (err) {
      console.error("[db] auto-migrate failed:", err);
    }
  }
  return db;
}

/**
 * Returns the shared Drizzle instance. Server-only (Server Components, Server
 * Actions, Route Handlers) — never import from a Client Component.
 */
export function getDb() {
  if (!_db) {
    _db = createDb();
    globalThis.__voicebotDb = _db;
  }
  return _db;
}
