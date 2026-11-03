import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { ThreadMessage } from "@/components/MessageThread";

/**
 * Loads a client's conversation for `reader`, then marks the other side's
 * messages as read. Messages that were unread before this view keep the
 * "new" marker for this one render.
 */
export async function loadThread(clientId: string, reader: "admin" | "client"): Promise<ThreadMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({ m: schema.messages, senderName: schema.users.name })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.senderUserId))
    .where(eq(schema.messages.clientId, clientId))
    .orderBy(schema.messages.createdAt);
  const other = reader === "admin" ? "client" : "admin";
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(
      and(eq(schema.messages.clientId, clientId), eq(schema.messages.sender, other), isNull(schema.messages.readAt)),
    );
  return rows.map(({ m, senderName }) => ({
    id: m.id,
    sender: m.sender,
    senderName: senderName ?? (m.sender === "admin" ? "Studio" : ""),
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    unread: m.sender === other && m.readAt === null,
  }));
}
