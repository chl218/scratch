import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// Uses a real Postgres server when DATABASE_URL is set; otherwise PGlite
// (Postgres compiled to WebAssembly) with its data in .data/pglite.
// Both speak the same SQL, so the rest of the app doesn't care which one runs.
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(url, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.resolve(
    /*turbopackIgnore: true*/ process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"),
  );
  mkdirSync(dataDir, { recursive: true });
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  // The two drivers share the same query API; the cast just picks one type.
  return db as unknown as DB;
}

// Keep one connection across hot reloads in development.
const g = globalThis as unknown as { __moodboardDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__moodboardDb) {
    g.__moodboardDb = connect().catch((err) => {
      g.__moodboardDb = undefined;
      throw err;
    });
  }
  return g.__moodboardDb;
}

export { schema };
