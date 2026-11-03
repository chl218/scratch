import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { baseUsername } from "../shared";

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

// Data fixes that SQL can't do on its own; runs after every migrate (cheap when nothing to do).
async function afterMigrate(db: DB): Promise<DB> {
  const missing = await db.select().from(schema.clients).where(isNull(schema.clients.username));
  if (missing.length > 0) {
    const all = await db.select({ username: schema.clients.username }).from(schema.clients);
    const taken = new Set(all.map((r) => r.username ?? ""));
    for (const c of missing) {
      const base = baseUsername(c.name);
      let username = base;
      for (let i = 2; taken.has(username); i++) username = `${base}${i}`;
      taken.add(username);
      await db.update(schema.clients).set({ username }).where(eq(schema.clients.id, c.id));
    }
  }
  await db.insert(schema.studioSettings).values({ id: 1 }).onConflictDoNothing();
  return db;
}

// Keep one connection across hot reloads in development.
const g = globalThis as unknown as { __moodboardDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__moodboardDb) {
    g.__moodboardDb = connect().then(afterMigrate).catch((err) => {
      g.__moodboardDb = undefined;
      throw err;
    });
  }
  return g.__moodboardDb;
}

export { schema };
