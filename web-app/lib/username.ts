import "server-only";
import { and, eq, like, ne, or } from "drizzle-orm";
import { getDb, schema } from "./db";

/** A username that isn't taken: jdoe, jdoe2, jdoe3… (F17) */
export async function uniqueUsername(base: string, exceptClientId?: string): Promise<string> {
  const db = await getDb();
  const rows = await db
    .select({ username: schema.clients.username })
    .from(schema.clients)
    .where(
      and(
        or(eq(schema.clients.username, base), like(schema.clients.username, `${base}%`)),
        exceptClientId ? ne(schema.clients.id, exceptClientId) : undefined,
      ),
    );
  return nextFreeUsername(base, new Set(rows.map((r) => r.username ?? "")));
}

export function nextFreeUsername(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}
