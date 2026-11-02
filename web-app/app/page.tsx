import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAdmin } from "@/lib/setup";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/account");
  redirect((await hasAdmin()) ? "/login" : "/setup");
}
