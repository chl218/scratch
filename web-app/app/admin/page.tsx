import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDate } from "@/lib/shared";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireAdmin();
  const db = await getDb();
  const [[photos], [clients], [unread], [pending], recent] = await Promise.all([
    db.select({ n: count() }).from(schema.photos),
    db.select({ n: count() }).from(schema.clients),
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(eq(schema.messages.sender, "client"), isNull(schema.messages.readAt))),
    db.select({ n: count() }).from(schema.paymentRequests).where(eq(schema.paymentRequests.status, "pending")),
    db
      .select({ page: schema.clientPages, clientName: schema.clients.name })
      .from(schema.clientPages)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
      .orderBy(desc(schema.clientPages.createdAt))
      .limit(8),
  ]);

  const stats = [
    { label: "Library photos", value: photos.n, href: "/admin/library" },
    { label: "Clients", value: clients.n, href: "/admin/clients" },
    { label: "Unread messages", value: unread.n, href: "/admin/inbox" },
    { label: "Open payment requests", value: pending.n, href: "/admin/payments" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-stone-400">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-stone-600">{s.label}</p>
          </Link>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent client pages</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">
            No client pages yet. <Link href="/admin/clients" className="underline">Add a client</Link> to create one.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {recent.map(({ page, clientName }) => (
              <li key={page.id}>
                <Link href={`/admin/pages/${page.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <span>
                    <span className="font-medium">{page.title}</span>{" "}
                    <span className="text-sm text-stone-500">· {clientName}</span>
                  </span>
                  <span className="text-sm text-stone-500">{page.shootDate ? formatDate(page.shootDate) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
