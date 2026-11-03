import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getSettings } from "./booking";
import { notifyClientAdmins } from "./notify";
import { appUrl } from "./tokens";

// Activity digest (SPEC F7): the client's choices, comments and favourites go out
// to admins as one email once a page has been quiet for the digest delay.

export async function recordActivity(pageId: string, kind: (typeof schema.activityEvents.$inferInsert)["kind"]) {
  const db = await getDb();
  await db.insert(schema.activityEvents).values({ pageId, kind });
}

const LABELS: Record<string, [string, string]> = {
  accepted: ["accepted a reference", "accepted references"],
  rejected: ["rejected a reference", "rejected references"],
  undecided: ["cleared a choice", "cleared choices"],
  added: ["added a reference from the library", "added references from the library"],
  comment: ["left a comment", "left comments"],
  favourite: ["changed a favourite", "changed favourites"],
};

/** Sends digests for pages whose latest activity is older than the delay. Returns how many were sent. */
export async function sendDueDigests(now = new Date()): Promise<number> {
  const db = await getDb();
  const { digestDelayMinutes } = await getSettings();
  const cutoff = new Date(now.getTime() - digestDelayMinutes * 60000);
  const due = await db
    .select({ pageId: schema.activityEvents.pageId })
    .from(schema.activityEvents)
    .where(isNull(schema.activityEvents.digestedAt))
    .groupBy(schema.activityEvents.pageId)
    .having(sql`max(${schema.activityEvents.createdAt}) <= ${cutoff}`);

  let sent = 0;
  for (const { pageId } of due) {
    // Claim the events first so a second runner can't send the same digest.
    const events = await db
      .update(schema.activityEvents)
      .set({ digestedAt: now })
      .where(and(eq(schema.activityEvents.pageId, pageId), isNull(schema.activityEvents.digestedAt)))
      .returning({ kind: schema.activityEvents.kind });
    if (events.length === 0) continue;
    const [row] = await db
      .select({ page: schema.clientPages, client: schema.clients })
      .from(schema.clientPages)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
      .where(inArray(schema.clientPages.id, [pageId]));
    if (!row) continue;

    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    const lines = [...counts].map(([kind, n]) => {
      const [one, many] = LABELS[kind] ?? [kind, kind];
      return n === 1 ? `- ${one}` : `- ${many} (${n})`;
    });
    await notifyClientAdmins(
      row.client.id,
      "activity",
      "activity",
      `${row.client.name} was busy on "${row.page.title}"`,
      `${row.client.name} made changes on "${row.page.title}":\n\n${lines.join("\n")}\n\n` +
        `Open the page: ${appUrl(`/admin/pages/${row.page.id}`)}\n`,
    );
    sent++;
  }
  return sent;
}

/** Started once per server process from instrumentation.ts. */
export function startDigestTimer() {
  const g = globalThis as unknown as { __digestTimer?: NodeJS.Timeout };
  if (g.__digestTimer) return;
  const every = Number(process.env.DIGEST_POLL_MS) || 60_000;
  g.__digestTimer = setInterval(() => {
    sendDueDigests().catch((err) => console.error("[digest] failed", err));
  }, every);
  g.__digestTimer.unref?.();
}
