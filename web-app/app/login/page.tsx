import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAdmin } from "@/lib/setup";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/account");
  if (!(await hasAdmin())) redirect("/setup");
  return (
    <AuthCard title="Log in" subtitle="Clients: you don't need to log in to choose photos. Just use your private link.">
      <LoginForm />
    </AuthCard>
  );
}
