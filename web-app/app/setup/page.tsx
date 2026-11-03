import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdmin } from "@/lib/setup";
import { AuthCard } from "@/components/AuthCard";
import { SetupForm } from "@/components/AuthForms";

export const metadata = { title: "Set up" };

// First run only: create the Super Admin (F12).
export default async function SetupPage() {
  await connection();
  if (await hasAdmin()) redirect("/login");
  return (
    <AuthCard title="Set up the studio" subtitle="Create the first admin account. It becomes the Super Admin, who approves new admins.">
      <SetupForm />
    </AuthCard>
  );
}
