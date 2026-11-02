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
    .select({
      client: schema.clients,
      pages: count(schema.clientPages.id),
    })
    .from(schema.clients)
    .leftJoin(schema.clientPages, eq(schema.clientPages.clientId, schema.clients.id))
    .groupBy(schema.clients.id)
    .orderBy(asc(schema.clients.name));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
      <NewClientForm action={createClientAction} />
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">No clients yet.</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {rows.map(({ client, pages }) => (
            <li key={client.id}>
              <Link
                href={`/admin/clients/${client.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-stone-50"
              >
                <span>
                  <span className="font-medium">{client.name}</span>{" "}
                  <span className="text-sm text-stone-500">{client.email}</span>
                </span>
                <span className="text-sm text-stone-500">
                  {pages} page{pages === 1 ? "" : "s"} · {client.userId ? "Has account" : "No account"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
