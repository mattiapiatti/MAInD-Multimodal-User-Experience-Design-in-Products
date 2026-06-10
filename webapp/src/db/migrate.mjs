// Applies Drizzle migrations to the local SQLite file. Run at container start
// (and manually via `npm run db:migrate`). Idempotent: already-applied
// migrations are skipped.
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve(process.env.DATABASE_PATH || "./data/app.db");
const MIGRATIONS_DIR = resolve("./src/db/migrations");

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  console.log(`[db] migrations applied → ${DB_PATH}`);
} catch (err) {
  console.error("[db] migration failed:", err);
  process.exitCode = 1;
} finally {
  sqlite.close();
}
