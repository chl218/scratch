import { notFound } from "next/navigation";
import { resolveArea } from "@/lib/area";
import { loadThread } from "@/lib/messages";
import { clientSendMessageAction } from "@/app/actions/client";
import { MessageThread } from "@/components/MessageThread";

export const metadata = { title: "Messages" };

// The client's one conversation with the studio (F10). Needs a login.
export default async function ClientMessages(props: PageProps<"/u/[username]/messages">) {
  const { username } = await props.params;
  const area = await resolveArea(username);
  if (!area?.loggedIn) notFound();
  const messages = await loadThread(area.client.id, "client");
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-[24px] font-semibold">Messages</h2>
      <MessageThread messages={messages} me="client" action={clientSendMessageAction} />
    </div>
  );
}
