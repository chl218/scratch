import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/payments";
import { formatDate } from "@/lib/shared";
import { setPaymentStatusAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ p: schema.paymentRequests, clientName: schema.clients.name })
    .from(schema.paymentRequests)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.paymentRequests.clientId))
    .orderBy(desc(schema.paymentRequests.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Payment requests</h1>
      <p className="text-sm text-stone-600">
        No payment provider is connected yet, so mark requests as paid when you receive the money. New requests are
        created from a client&apos;s page.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">No payment requests yet.</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {rows.map(({ p, clientName }) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium">{formatMoney(p.amountCents, p.currency)}</span>{" "}
                <span className="text-sm text-stone-600">{p.description}</span>
                <span className="block text-xs text-stone-500">
                  <Link href={`/admin/clients/${p.clientId}`} className="underline">{clientName}</Link> · {formatDate(p.createdAt)}
                  {p.paidAt && ` · paid ${formatDate(p.paidAt)}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                {p.status === "pending" ? (
                  <>
                    <ActionButton action={setPaymentStatusAction.bind(null, p.id, "paid")}>Mark paid</ActionButton>
                    <ActionButton action={setPaymentStatusAction.bind(null, p.id, "cancelled")} confirm="Cancel this payment request?">
                      Cancel
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton action={setPaymentStatusAction.bind(null, p.id, "pending")} confirm="Set this request back to pending?">
                    Reopen
                  </ActionButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
