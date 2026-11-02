import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { completeAccountTokenAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { PasswordForm } from "@/components/AuthForms";

export const metadata = { title: "Set your password", referrer: "no-referrer" };

// Handles both account invites and password resets.
export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const db = await getDb();
  const [row] = await db
    .select({ purpose: schema.accountTokens.purpose })
    .from(schema.accountTokens)
    .where(
      and(
        eq(schema.accountTokens.id, hashToken(token)),
        isNull(schema.accountTokens.usedAt),
        gt(schema.accountTokens.expiresAt, new Date()),
      ),
    );

  if (!row) {
    return (
      <AuthCard title="Link expired" subtitle="This link has expired or was already used.">
        <p className="text-center text-sm">
          <Link href="/forgot" className="underline">Request a new password link</Link> or ask your photographer for a new invite.
        </p>
      </AuthCard>
    );
  }

  const invite = row.purpose === "invite";
  return (
    <AuthCard
      title={invite ? "Create your account" : "Choose a new password"}
      subtitle={invite ? "Use your account to message your photographer and pay invoices." : undefined}
    >
      <PasswordForm
        action={completeAccountTokenAction.bind(null, token)}
        submitLabel={invite ? "Create account" : "Save password"}
      />
    </AuthCard>
  );
}
