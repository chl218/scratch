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
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/admin/inbox" className="text-sm text-loupe hover:text-graphite">Inbox</Link>
        <h1 className="display text-[36px]">
          <Link href={`/admin/clients/${client.id}`} className="hover:underline">{client.name}</Link>
        </h1>
      </div>
      {!client.userId && (
        <p className="error-note">
          {client.name} doesn&apos;t have an account yet, so they can&apos;t reply here. They&apos;ll get your message by email.{" "}
          <Link href={`/admin/clients/${client.id}`} className="font-semibold underline">Send an invite</Link>
        </p>
      )}
      <MessageThread messages={messages} me="admin" action={adminSendMessageAction.bind(null, client.id)} />
    </div>
  );
}
