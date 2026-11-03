import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDateTime } from "@/lib/shared";
import { setContactHandledAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";

export const metadata = { title: "Inbox" };

// All client conversations, unread first (F10), and the contact form inbox (F16).
export default async function InboxPage(props: PageProps<"/admin/inbox">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tab = sp.tab === "contact" ? "contact" : "clients";
  const db = await getDb();
  const m = schema.messages;

  const [threads, contact] = await Promise.all([
    db
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
      .orderBy(sql`count(*) filter (where ${m.sender} = 'client' and ${m.readAt} is null) > 0 desc`, sql`max(${m.createdAt}) desc`),
    db.select().from(schema.contactMessages).orderBy(sql`${schema.contactMessages.handledAt} is not null`, desc(schema.contactMessages.createdAt)),
  ]);
  const openContact = contact.filter((c) => !c.handledAt).length;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="display text-[36px]">Inbox</h1>
      <div className="flex gap-2">
        <Link href="/admin/inbox" aria-current={tab === "clients" ? "page" : undefined} className={`pill ${tab === "clients" ? "pill-on" : ""}`}>
          Clients
        </Link>
        <Link href="/admin/inbox?tab=contact" aria-current={tab === "contact" ? "page" : undefined} className={`pill ${tab === "contact" ? "pill-on" : ""}`}>
          Contact form {openContact > 0 && <span className="opacity-75">{openContact}</span>}
        </Link>
      </div>

      {tab === "clients" ? (
        threads.length === 0 ? (
          <p className="text-loupe">
            No messages yet. Start a conversation from a <Link href="/admin/clients" className="underline">client&apos;s page</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {threads.map((r) => (
              <li key={r.clientId}>
                <Link href={`/admin/inbox/${r.clientId}`} className="flex items-start justify-between gap-4 px-3 py-2 hover:bg-table">
                  <span className="min-w-0">
                    <span className={r.unread ? "font-semibold" : ""}>{r.name}</span>
                    <span className="block truncate text-loupe">{r.last}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-loupe">{formatDateTime(r.lastAt)}</span>
                    {r.unread > 0 && <span className="rounded-full bg-marker px-2 text-xs font-semibold text-white">{r.unread} new</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : contact.length === 0 ? (
        <p className="text-loupe">Nothing from the contact form yet.</p>
      ) : (
        <ul className="space-y-3">
          {contact.map((c) => (
            <li key={c.id} className={`panel space-y-2 ${c.handledAt ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {c.name} <a href={`mailto:${c.email}`} className="font-normal text-loupe underline">{c.email}</a>
                </p>
                <span className="text-xs text-loupe">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              <ActionButton className="btn-quiet -ml-2" action={setContactHandledAction.bind(null, c.id, !c.handledAt)}>
                {c.handledAt ? "Mark as open" : "Mark as handled"}
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
