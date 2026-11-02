import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdmin } from "@/lib/setup";
import { AuthCard } from "@/components/AuthCard";
import { SetupForm } from "@/components/AuthForms";

export const metadata = { title: "Set up" };

// First run only: create the photographer's admin account.
export default async function SetupPage() {
  await connection();
  if (await hasAdmin()) redirect("/login");
  return (
    <AuthCard title="Welcome to Moodboard" subtitle="Create the photographer (admin) account to get started.">
      <SetupForm />
    </AuthCard>
  );
}
