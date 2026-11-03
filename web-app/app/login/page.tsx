import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { hasAdmin } from "@/lib/setup";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  const user = await getCurrentUser();
  if (user) {
    if (next) redirect(next);
    if (user.role === "admin") redirect("/admin");
    const db = await getDb();
    const [client] = await db.select({ username: schema.clients.username }).from(schema.clients).where(eq(schema.clients.userId, user.id));
    redirect(client?.username ? `/u/${client.username}` : "/");
  }
  if (!(await hasAdmin())) redirect("/setup");
  return (
    <AuthCard title="Log in" subtitle="Clients: you don't need to log in to choose references or download photos. Your private link is enough.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
