import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireClient } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDate } from "@/lib/shared";
import { formatMoney } from "@/lib/payments";

export const metadata = { title: "My account" };

// Client dashboard (F9): all their pages, unread messages, open payments.
export default async function AccountHome() {
  const { client } = await requireClient();
  const db = await getDb();
  const [pages, [unread], pending] = await Promise.all([
    db
      .select()
      .from(schema.clientPages)
      .where(eq(schema.clientPages.clientId, client.id))
      .orderBy(desc(schema.clientPages.createdAt)),
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.clientId, client.id),
          eq(schema.messages.sender, "admin"),
          isNull(schema.messages.readAt),
        ),
      ),
    db
      .select()
      .from(schema.paymentRequests)
      .where(and(eq(schema.paymentRequests.clientId, client.id), eq(schema.paymentRequests.status, "pending"))),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Hi {client.name}</h1>

      {(unread.n > 0 || pending.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {unread.n > 0 && (
            <Link href="/account/messages" className="card hover:border-stone-400">
              <p className="font-medium">
                {unread.n} unread message{unread.n === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-stone-600">from your photographer</p>
            </Link>
          )}
          {pending.length > 0 && (
            <Link href="/account/payments" className="card hover:border-stone-400">
              <p className="font-medium">
                {pending.length} payment request{pending.length === 1 ? "" : "s"} open
              </p>
              <p className="text-sm text-stone-600">
                {pending.map((p) => formatMoney(p.amountCents, p.currency)).join(", ")}
              </p>
            </Link>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My shoots</h2>
        {pages.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing here yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/account/pages/${p.id}`} className="card block hover:border-stone-400">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-stone-600">
                    {p.shootDate ? formatDate(p.shootDate) : "Date to be confirmed"}
                    {p.shootPhotosVisible && " · Photos ready"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
