import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { loadThread } from "@/lib/messages";
import { adminSendMessageAction } from "@/app/actions/admin";
import { MessageThread } from "@/components/MessageThread";

export const metadata = { title: "Messages" };

export default async function ConversationPage(props: PageProps<"/admin/inbox/[clientId]">) {
  await requireAdmin();
  const { clientId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) notFound();
  const messages = await loadThread(client.id, "admin");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/inbox" className="text-sm text-stone-500 hover:text-stone-900">← Inbox</Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          <Link href={`/admin/clients/${client.id}`} className="hover:underline">{client.name}</Link>
        </h1>
      </div>
      {!client.userId && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {client.name} doesn&apos;t have an account yet, so they can&apos;t reply. They&apos;ll get your message by email.{" "}
          <Link href={`/admin/clients/${client.id}`} className="underline">Send an invite</Link>.
        </p>
      )}
      <MessageThread
        messages={messages}
        me="admin"
        otherName={client.name}
        action={adminSendMessageAction.bind(null, client.id)}
      />
    </div>
  );
}
