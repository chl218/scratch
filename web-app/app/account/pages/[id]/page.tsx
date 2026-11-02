import { notFound } from "next/navigation";
import { tryPageAccess } from "@/lib/access";
import { ClientPageView } from "@/components/ClientPageView";

export const metadata = { title: "Your shoot" };

// Same page as the private link, reached through the client's account (F9).
export default async function AccountPage(props: PageProps<"/account/pages/[id]">) {
  const { id } = await props.params;
  const access = await tryPageAccess(`p:${id}`);
  if (!access || access.actor.type !== "client") notFound();
  return <ClientPageView access={access} />;
}
