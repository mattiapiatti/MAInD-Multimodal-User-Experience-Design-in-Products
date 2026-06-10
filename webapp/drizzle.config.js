import { defineConfig } from "drizzle-kit";

// Durable Object SQLite storage (not D1, not a local file). Migrations are
// generated into ./drizzle and bundled into the Worker as text.
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.js",
  dialect: "sqlite",
  driver: "durable-sqlite",
});
