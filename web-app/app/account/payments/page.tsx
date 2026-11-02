import { desc, eq } from "drizzle-orm";
import { requireClient } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/payments";
import { formatDate } from "@/lib/shared";
import { PayButton } from "@/components/PayButton";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Payments" };

export default async function AccountPayments() {
  const { client } = await requireClient();
  const db = await getDb();
  const rows = await db
    .select({ payment: schema.paymentRequests, pageTitle: schema.clientPages.title })
    .from(schema.paymentRequests)
    .leftJoin(schema.clientPages, eq(schema.clientPages.id, schema.paymentRequests.pageId))
    .where(eq(schema.paymentRequests.clientId, client.id))
    .orderBy(desc(schema.paymentRequests.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      {rows.length === 0 && <p className="text-sm text-stone-500">No payment requests.</p>}
      <ul className="space-y-3">
        {rows.map(({ payment: p, pageTitle }) => (
          <li key={p.id} className="card flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{formatMoney(p.amountCents, p.currency)}</p>
              <p className="text-sm text-stone-700">{p.description}</p>
              <p className="text-xs text-stone-500">
                Requested {formatDate(p.createdAt)}
                {pageTitle && ` · ${pageTitle}`}
                {p.paidAt && ` · Paid ${formatDate(p.paidAt)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={p.status} />
              {p.status === "pending" && <PayButton paymentId={p.id} label="Pay now" />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
