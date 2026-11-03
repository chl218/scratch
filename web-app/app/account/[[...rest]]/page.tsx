import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";

// Old /account links (from emails sent before v0.6) go to the client area.
export default async function OldAccount(props: PageProps<"/account/[[...rest]]">) {
  const { client } = await requireClient();
  const { rest } = await props.params;
  redirect(`/u/${client.username}${rest?.[0] === "messages" ? "/messages" : ""}`);
}
