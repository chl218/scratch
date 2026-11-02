import { requireClient } from "@/lib/auth";
import { loadThread } from "@/lib/messages";
import { clientSendMessageAction } from "@/app/actions/account";
import { MessageThread } from "@/components/MessageThread";

export const metadata = { title: "Messages" };

export default async function AccountMessages() {
  const { client } = await requireClient();
  const messages = await loadThread(client.id, "client");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <MessageThread messages={messages} me="client" otherName="Photographer" action={clientSendMessageAction} />
    </div>
  );
}
