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
        <p className="text-sm">
          <Link href="/forgot" className="font-semibold underline underline-offset-4">Request a new password link</Link> or
          ask the studio for a new invite.
        </p>
      </AuthCard>
    );
  }

  const invite = row.purpose !== "reset";
  return (
    <AuthCard
      title={invite ? "Create your account" : "Choose a new password"}
      subtitle={
        row.purpose === "admin_invite"
          ? "You've been invited as an admin of the studio."
          : invite
            ? "With an account you can comment on photos, message the studio and book shoots."
            : undefined
      }
    >
      <PasswordForm
        action={completeAccountTokenAction.bind(null, token)}
        submitLabel={invite ? "Create account" : "Save password"}
      />
    </AuthCard>
  );
}
