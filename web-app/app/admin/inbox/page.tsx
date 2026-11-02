import Link from "next/link";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDateTime } from "@/lib/shared";

export const metadata = { title: "Inbox" };

// All client conversations, unread first (F10).
export default async function InboxPage() {
  await requireAdmin();
  const db = await getDb();
  const m = schema.messages;
  const rows = await db
    .select({
      clientId: schema.clients.id,
      name: schema.clients.name,
      lastAt: sql<string>`max(${m.createdAt})`,
      unread: sql<number>`count(*) filter (where ${m.sender} = 'client' and ${m.readAt} is null)::int`,
      last: sql<string>`(array_agg(${m.body} order by ${m.createdAt} desc))[1]`,
    })
    .from(m)
    .innerJoin(schema.clients, sql`${schema.clients.id} = ${m.clientId}`)
    .groupBy(schema.clients.id, schema.clients.name)
    .orderBy(sql`count(*) filter (where ${m.sender} = 'client' and ${m.readAt} is null) > 0 desc`, sql`max(${m.createdAt}) desc`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">
          No messages yet. Start a conversation from a <Link href="/admin/clients" className="underline">client&apos;s page</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {rows.map((r) => (
            <li key={r.clientId}>
              <Link href={`/admin/inbox/${r.clientId}`} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-stone-50">
                <span className="min-w-0">
                  <span className={r.unread ? "font-semibold" : "font-medium"}>{r.name}</span>
                  <span className="block truncate text-sm text-stone-600">{r.last}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-stone-500">{formatDateTime(r.lastAt)}</span>
                  {r.unread > 0 && (
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">{r.unread} new</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
