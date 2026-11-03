import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { createClientAction } from "@/app/actions/admin";
import { NewClientForm } from "@/components/AdminForms";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ client: schema.clients, pages: count(schema.clientPages.id) })
    .from(schema.clients)
    .leftJoin(schema.clientPages, eq(schema.clientPages.clientId, schema.clients.id))
    .groupBy(schema.clients.id)
    .orderBy(asc(schema.clients.name));

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="display text-[36px]">Clients</h1>
      <NewClientForm action={createClientAction} />
      {rows.length === 0 ? (
        <p className="text-loupe">No clients yet. Add one above, or they appear when someone books.</p>
      ) : (
        <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
          {rows.map(({ client, pages }) => (
            <li key={client.id}>
              <Link href={`/admin/clients/${client.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-table">
                <span>
                  <span className="font-semibold">{client.name}</span> <span className="text-loupe">{client.email}</span>
                </span>
                <span className="text-loupe">
                  /u/{client.username}. {pages} page{pages === 1 ? "" : "s"}. {client.userId ? "Has an account" : "No account"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
