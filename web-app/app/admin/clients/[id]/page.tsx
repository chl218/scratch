import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDate } from "@/lib/shared";
import { formatMoney } from "@/lib/payments";
import {
  createPageAction,
  createPaymentAction,
  sendInviteAction,
  setClientDisabledAction,
  setPaymentStatusAction,
} from "@/app/actions/admin";
import { PageForm, PaymentForm } from "@/components/AdminForms";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Client" };

export default async function ClientDetail(props: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
  if (!client) notFound();

  const [account] = client.userId
    ? await db.select().from(schema.users).where(eq(schema.users.id, client.userId))
    : [];
  const [pages, payments] = await Promise.all([
    db.select().from(schema.clientPages).where(eq(schema.clientPages.clientId, id)).orderBy(desc(schema.clientPages.createdAt)),
    db.select().from(schema.paymentRequests).where(eq(schema.paymentRequests.clientId, id)).orderBy(desc(schema.paymentRequests.createdAt)),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/clients" className="text-sm text-stone-500 hover:text-stone-900">← Clients</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-stone-600">{client.email}</p>
        </div>
        <Link href={`/admin/inbox/${client.id}`} className="btn-secondary">Messages</Link>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Account</h2>
        {!account ? (
          <>
            <p className="text-sm text-stone-600">
              No account yet. An account lets the client message you and pay. Their private links work without one.
            </p>
            <ActionButton action={sendInviteAction.bind(null, client.id)} className="btn-primary" pendingText="Sending…">
              Send account invite
            </ActionButton>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-stone-600">
              {account.disabled ? "Account disabled." : `Active since ${formatDate(account.createdAt)}.`}
            </p>
            <ActionButton
              action={setClientDisabledAction.bind(null, client.id, !account.disabled)}
              className={account.disabled ? "btn-secondary" : "btn-danger"}
              confirm={account.disabled ? undefined : "Disable this account? The client is logged out, but their private links keep working."}
            >
              {account.disabled ? "Enable account" : "Disable account"}
            </ActionButton>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Client pages</h2>
        {pages.length > 0 && (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pages/${p.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-sm text-stone-500">
                    {p.shootDate ? formatDate(p.shootDate) : "No date"}
                    {p.shootPhotosVisible && " · Photos delivered"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <details className="card" open={pages.length === 0}>
          <summary className="cursor-pointer font-medium">New client page</summary>
          <div className="pt-4">
            <PageForm action={createPageAction.bind(null, client.id)} submitLabel="Create page" />
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payment requests</h2>
        {payments.length > 0 && (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{formatMoney(p.amountCents, p.currency)}</span>{" "}
                  <span className="text-sm text-stone-600">{p.description}</span>{" "}
                  <span className="text-xs text-stone-500">· {formatDate(p.createdAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {p.status === "pending" && (
                    <>
                      <ActionButton action={setPaymentStatusAction.bind(null, p.id, "paid")}>Mark paid</ActionButton>
                      <ActionButton action={setPaymentStatusAction.bind(null, p.id, "cancelled")} confirm="Cancel this payment request?">
                        Cancel
                      </ActionButton>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <details className="card">
          <summary className="cursor-pointer font-medium">New payment request</summary>
          <div className="pt-4">
            {!account && (
              <p className="mb-3 text-sm text-amber-800">
                The client needs an account to see and pay requests. Send an invite above.
              </p>
            )}
            <PaymentForm action={createPaymentAction.bind(null, client.id)} pages={pages.map((p) => ({ id: p.id, title: p.title }))} />
          </div>
        </details>
      </section>
    </div>
  );
}
