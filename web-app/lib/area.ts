import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getCurrentUser } from "./auth";
import { linkedPagesFor } from "./links";

export type ClientArea = {
  client: typeof schema.clients.$inferSelect;
  /** True when the client is logged in; false for someone who only opened a private link. */
  loggedIn: boolean;
  /** Pages this visitor may open, each with its access key. */
  pages: { page: typeof schema.clientPages.$inferSelect; key: string }[];
};

/**
 * Who may open /u/<username> (F17): the logged-in client, or a browser that has opened
 * one of that client's valid private links. Everyone else gets null ("not found").
 */
export async function resolveArea(username: string): Promise<ClientArea | null> {
  if (!/^[a-z0-9]{1,40}$/.test(username)) return null;
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.username, username));
  if (!client) return null;
  const all = await db
    .select()
    .from(schema.clientPages)
    .where(eq(schema.clientPages.clientId, client.id))
    .orderBy(desc(schema.clientPages.createdAt));

  const user = await getCurrentUser();
  if (user?.role === "client" && client.userId === user.id) {
    return { client, loggedIn: true, pages: all.map((page) => ({ page, key: `p:${page.id}` })) };
  }
  const linked = await linkedPagesFor(client.id);
  if (linked.size === 0) return null;
  return {
    client,
    loggedIn: false,
    pages: all.filter((p) => linked.has(p.id)).map((page) => ({ page, key: `t:${linked.get(page.id)}` })),
  };
}
