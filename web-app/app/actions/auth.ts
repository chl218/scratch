"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { hashToken, newToken, appUrl } from "@/lib/tokens";
import { sendMail } from "@/lib/mail";
import { PRODUCT } from "@/lib/notify";

export type FormState = { error?: string; ok?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Password must be at least 8 characters.").max(200);

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

/** Where a user goes after logging in: admins to /admin, clients to their area. */
async function landingFor(user: { id: string; role: "admin" | "client" }): Promise<string> {
  if (user.role === "admin") return "/admin";
  const db = await getDb();
  const [client] = await db
    .select({ username: schema.clients.username })
    .from(schema.clients)
    .where(eq(schema.clients.userId, user.id));
  return client?.username ? `/u/${client.username}` : "/";
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password.") })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  const ok = user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "Email or password is incorrect." };
  if (user.disabled) return { error: "This account has been disabled. Contact the studio." };

  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : await landingFor(user));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** First run: creates the Super Admin (F12). Only works while no admin exists. */
export async function setupAdminAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name.").max(100), email, password })
    .safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);
  if (existing) return { error: "An admin account already exists. Log in instead." };

  const [user] = await db
    .insert(schema.users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "admin",
      isSuperAdmin: true,
    })
    .returning();
  await db.insert(schema.teamProfiles).values({ userId: user.id, displayName: user.name });
  await createSession(user.id);
  redirect("/admin");
}

/** Completes a client invite, an approved admin invite, or a password reset. */
export async function completeAccountTokenAction(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords don't match." })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.accountTokens)
    .where(
      and(
        eq(schema.accountTokens.id, hashToken(token)),
        isNull(schema.accountTokens.usedAt),
        gt(schema.accountTokens.expiresAt, new Date()),
      ),
    );
  if (!row) return { error: "This link has expired or was already used. Ask the studio for a new one." };

  const passwordHash = await hashPassword(parsed.data.password);
  let userId: string;

  if (row.purpose === "invite") {
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, row.clientId!));
    if (!client) return { error: "This invite is no longer valid." };
    if (client.userId) {
      await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, client.userId));
      userId = client.userId;
    } else {
      const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, client.email));
      if (taken) return { error: "An account with this email already exists. Log in instead." };
      const [user] = await db
        .insert(schema.users)
        .values({ name: client.name, email: client.email, passwordHash, role: "client" })
        .returning();
      await db.update(schema.clients).set({ userId: user.id }).where(eq(schema.clients.id, client.id));
      userId = user.id;
    }
  } else if (row.purpose === "admin_invite") {
    const [invite] = await db.select().from(schema.adminInvites).where(eq(schema.adminInvites.id, row.adminInviteId!));
    if (!invite || invite.status !== "approved") return { error: "This invite is no longer valid." };
    const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, invite.email));
    if (taken) return { error: "An account with this email already exists. Log in instead." };
    const [user] = await db
      .insert(schema.users)
      .values({ name: invite.name, email: invite.email, passwordHash, role: "admin" })
      .returning();
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${schema.teamProfiles.sortOrder}), 0)::int` })
      .from(schema.teamProfiles);
    await db.insert(schema.teamProfiles).values({ userId: user.id, displayName: user.name, sortOrder: max + 1 });
    userId = user.id;
  } else {
    userId = row.userId!;
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
    // A password reset logs out every other session.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  await db.update(schema.accountTokens).set({ usedAt: new Date() }).where(eq(schema.accountTokens.id, row.id));

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (user.disabled) return { error: "This account has been disabled. Contact the studio." };
  await createSession(userId);
  redirect(await landingFor(user));
}

export async function requestResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data));
  if (user && !user.disabled) {
    const token = newToken();
    await db.insert(schema.accountTokens).values({
      id: hashToken(token),
      purpose: "reset",
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sendMail({
      to: user.email,
      subject: `Reset your ${PRODUCT} password`,
      text:
        `Hi ${user.name},\n\nUse this link to choose a new password. It works for one hour:\n` +
        `${appUrl(`/invite/${token}`)}\n\nIf you didn't ask for this, you can ignore this email.\n`,
    });
  }
  // Same answer either way, so this form can't be used to check which emails have accounts.
  return { ok: "If that email has an account, a reset link is on its way." };
}
