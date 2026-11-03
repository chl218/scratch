import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/booking";
import { formatDate } from "@/lib/shared";
import { formatWhen } from "@/lib/time";
import {
  assignAdminAction,
  createPageAction,
  sendInviteAction,
  setClientDisabledAction,
  unassignAdminAction,
  updateClientAction,
} from "@/app/actions/admin";
import { AssignAdmin, ClientDetailsForm, PageForm } from "@/components/AdminForms";
import { ActionButton } from "@/components/ActionButton";

export const metadata = { title: "Client" };

export default async function ClientDetail(props: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
  if (!client) notFound();

  const [account] = client.userId ? await db.select().from(schema.users).where(eq(schema.users.id, client.userId)) : [];
  const [pages, assigned, admins, bookings, settings] = await Promise.all([
    db.select().from(schema.clientPages).where(eq(schema.clientPages.clientId, id)).orderBy(desc(schema.clientPages.createdAt)),
    db
      .select({ id: schema.users.id, name: schema.users.name, isSuperAdmin: schema.users.isSuperAdmin })
      .from(schema.clientAdmins)
      .innerJoin(schema.users, eq(schema.users.id, schema.clientAdmins.adminId))
      .where(eq(schema.clientAdmins.clientId, id)),
    db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(and(eq(schema.users.role, "admin"), eq(schema.users.disabled, false))),
    db
      .select({ b: schema.bookings, adminName: schema.users.name })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.adminId))
      .where(eq(schema.bookings.clientId, id))
      .orderBy(desc(schema.bookings.startsAt)),
    getSettings(),
  ]);
  const unassigned = admins.filter((a) => !assigned.some((x) => x.id === a.id));

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/clients" className="text-sm text-loupe hover:text-graphite">Clients</Link>
          <h1 className="display text-[36px]">{client.name}</h1>
          <p className="text-sm text-loupe">
            {client.email}. Client area: /u/{client.username}
          </p>
        </div>
        <Link href={`/admin/inbox/${client.id}`} className="btn-secondary">Messages</Link>
      </div>

      <section className="panel space-y-3">
        <h2 className="font-semibold">Details</h2>
        <ClientDetailsForm action={updateClientAction.bind(null, client.id)} name={client.name} username={client.username ?? ""} />
      </section>

      <section className="panel space-y-3">
        <h2 className="font-semibold">Assigned admins</h2>
        <p className="text-sm text-loupe">They get this client&apos;s emails, along with the Super Admin, and the client sees them as contacts.</p>
        <ul className="space-y-1 text-sm">
          {assigned.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{a.name}</span>
              {a.isSuperAdmin && <span className="text-xs text-loupe">Super Admin</span>}
              {assigned.length > 1 && (
                <ActionButton className="btn-quiet" action={unassignAdminAction.bind(null, client.id, a.id)}>
                  Remove
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
        <AssignAdmin admins={unassigned} assign={assignAdminAction.bind(null, client.id)} />
      </section>

      <section className="panel space-y-3">
        <h2 className="font-semibold">Account</h2>
        {!account ? (
          <>
            <p className="text-sm text-loupe">
              No account yet. An account lets the client comment, message the studio and book. Their private links work without one.
            </p>
            <ActionButton action={sendInviteAction.bind(null, client.id)} className="btn-primary" pendingText="Sending…">
              Send account invite
            </ActionButton>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-loupe">
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
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pages/${p.id}`} className="flex justify-between gap-3 px-3 py-2 hover:bg-table">
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-loupe">
                    {p.shootDate ? formatDate(p.shootDate) : "No date"}
                    {p.shootPhotosVisible && ". Locked, photos delivered"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <details className="panel" open={pages.length === 0}>
          <summary className="cursor-pointer font-semibold">New client page</summary>
          <div className="pt-4">
            <PageForm action={createPageAction.bind(null, client.id)} submitLabel="Create page" />
          </div>
        </details>
      </section>

      {bookings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Bookings</h2>
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {bookings.map(({ b, adminName }) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className={b.status === "cancelled" ? "text-loupe line-through" : ""}>
                  {b.sessionName}, {formatWhen(b.startsAt, settings.timeZone)}
                </span>
                <span className="text-loupe">{adminName}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
