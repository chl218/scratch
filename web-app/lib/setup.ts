import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export async function hasAdmin(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);
  return Boolean(row);
}
