import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getCurrentUser } from "./auth";

export type Actor = {
  type: "admin" | "client";
  name: string;
  /** The logged-in user acting, or null for someone using only the private link. */
  userId: string | null;
};

export type PageAccess = {
  page: typeof schema.clientPages.$inferSelect;
  client: typeof schema.clients.$inferSelect;
  actor: Actor;
  /** The key the browser uses for this page: "t:<token>" or "p:<pageId>". */
  key: string;
};

export class AccessError extends Error {}

/** True when the page is locked: Your Photos is visible and the Board is hidden (F6). */
export function isLocked(page: { shootPhotosVisible: boolean }): boolean {
  return page.shootPhotosVisible;
}

/**
 * Works out who may act on a client page. Two ways in:
 *  - "t:<token>": the private link. No login needed (F3).
 *  - "p:<pageId>": a logged-in client who owns the page, or an admin.
 * A logged-in owner using the private link counts as logged in (needed for comments, F5).
 */
export async function resolvePageAccess(key: string): Promise<PageAccess> {
  const db = await getDb();
  const [kind, value] = [key.slice(0, 2), key.slice(2)];
  if (!value) throw new AccessError("Not found");

  const select = () =>
    db
      .select({ page: schema.clientPages, client: schema.clients })
      .from(schema.clientPages)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId));

  let row: { page: PageAccess["page"]; client: PageAccess["client"] } | undefined;
  if (kind === "t:") {
    [row] = await select().where(eq(schema.clientPages.linkToken, value));
  } else if (kind === "p:" && /^[0-9a-f-]{36}$/i.test(value)) {
    [row] = await select().where(eq(schema.clientPages.id, value));
  }
  if (!row) throw new AccessError("Not found");

  const user = await getCurrentUser();
  if (user?.role === "admin") {
    return { ...row, actor: { type: "admin", name: user.name, userId: user.id }, key };
  }
  const owner = user?.role === "client" && row.client.userId === user.id;
  if (kind === "p:" && !owner) throw new AccessError("Not found");
  return {
    ...row,
    actor: { type: "client", name: row.client.name, userId: owner ? user!.id : null },
    key,
  };
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
