import { AuthCard } from "@/components/AuthCard";
import { ForgotForm } from "@/components/AuthForms";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <ForgotForm />
    </AuthCard>
  );
}
