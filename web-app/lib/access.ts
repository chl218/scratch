import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getCurrentUser } from "./auth";

export type PageAccess = {
  page: typeof schema.clientPages.$inferSelect;
  client: typeof schema.clients.$inferSelect;
  actor: { type: "admin" | "client"; name: string };
  /** The key the browser uses for this page: "t:<token>" or "p:<pageId>". */
  key: string;
};

export class AccessError extends Error {}

/**
 * Works out who may act on a client page. Two ways in:
 *  - "t:<token>": the private link. No login needed (SPEC F3).
 *  - "p:<pageId>": a logged-in client who owns the page, or an admin.
 */
export async function resolvePageAccess(key: string): Promise<PageAccess> {
  const db = await getDb();
  const [kind, value] = [key.slice(0, 2), key.slice(2)];
  if (!value) throw new AccessError("Not found");

  if (kind === "t:") {
    const [row] = await db
      .select({ page: schema.clientPages, client: schema.clients })
      .from(schema.clientPages)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
      .where(eq(schema.clientPages.linkToken, value));
    if (!row) throw new AccessError("Not found");
    return { ...row, actor: { type: "client", name: row.client.name }, key };
  }

  if (kind === "p:") {
    if (!/^[0-9a-f-]{36}$/i.test(value)) throw new AccessError("Not found");
    const user = await getCurrentUser();
    if (!user) throw new AccessError("Not found");
    const [row] = await db
      .select({ page: schema.clientPages, client: schema.clients })
      .from(schema.clientPages)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
      .where(eq(schema.clientPages.id, value));
    if (!row) throw new AccessError("Not found");
    if (user.role === "admin") return { ...row, actor: { type: "admin", name: "Admin" }, key };
    if (row.client.userId === user.id) {
      return { ...row, actor: { type: "client", name: row.client.name }, key };
    }
    throw new AccessError("Not found");
  }

  throw new AccessError("Not found");
}

/** Like resolvePageAccess, but returns null instead of throwing. */
export async function tryPageAccess(key: string): Promise<PageAccess | null> {
  try {
    return await resolvePageAccess(key);
  } catch (err) {
    if (err instanceof AccessError) return null;
    throw err;
  }
}
