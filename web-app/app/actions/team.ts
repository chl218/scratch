"use server";

import { refresh } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { assertAdmin, assertSuperAdmin, type CurrentUser } from "@/lib/auth";
import { appUrl, hashToken, newToken } from "@/lib/tokens";
import { notifyClient, notifySuperAdmin, PRODUCT } from "@/lib/notify";
import { sendMail } from "@/lib/mail";
import { formatWhen, zonedToUtc } from "@/lib/time";
import { getSettings } from "@/lib/booking";
import type { FormState } from "./auth";

const id = z.string().uuid();

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

// ---------- Admin invites (F12) ----------

async function sendAdminInvite(inviteId: string) {
  const db = await getDb();
  const [invite] = await db.select().from(schema.adminInvites).where(eq(schema.adminInvites.id, inviteId));
  if (!invite) return;
  const token = newToken();
  await db.insert(schema.accountTokens).values({
    id: hashToken(token),
    purpose: "admin_invite",
    adminInviteId: invite.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await sendMail({
    to: invite.email,
    subject: `You're invited to join the studio on ${PRODUCT}`,
    text:
      `Hi ${invite.name},\n\nYou've been invited as an admin of the studio.\n\n` +
      `Set your password here (the link works for 7 days):\n${appUrl(`/invite/${token}`)}\n`,
  });
}

export async function inviteAdminAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await assertAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter their name.").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    })
    .safeParse({ name: form.get("name"), email: form.get("email") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (taken) return { error: "Someone already has an account with this email." };
  const [open] = await db
    .select({ id: schema.adminInvites.id })
    .from(schema.adminInvites)
    .where(and(eq(schema.adminInvites.email, parsed.data.email), eq(schema.adminInvites.status, "pending")));
  if (open) return { error: "An invite for this email is already waiting for approval." };

  const status = me.isSuperAdmin ? "approved" : "pending";
  const [invite] = await db
    .insert(schema.adminInvites)
    .values({ ...parsed.data, invitedBy: me.id, status, decidedAt: me.isSuperAdmin ? new Date() : null })
    .returning();

  if (me.isSuperAdmin) {
    await sendAdminInvite(invite.id);
    refresh();
    return { ok: `Invite sent to ${invite.email}.` };
  }
  await notifySuperAdmin(
    "admin_invite",
    `${me.name} wants to add ${invite.name} as an admin`,
    `${me.name} invited ${invite.name} (${invite.email}) to be an admin.\n\nApprove or decline it here: ${appUrl("/admin/team")}\n`,
  );
  refresh();
  return { ok: "Invite created. It goes out once the Super Admin approves it." };
}

export async function decideAdminInviteAction(inviteId: string, approve: boolean): Promise<FormState> {
  await assertSuperAdmin();
  id.parse(inviteId);
  const db = await getDb();
  const [invite] = await db.select().from(schema.adminInvites).where(eq(schema.adminInvites.id, inviteId));
  if (!invite || invite.status !== "pending") return { error: "This invite was already handled." };
  await db
    .update(schema.adminInvites)
    .set({ status: approve ? "approved" : "declined", decidedAt: new Date() })
    .where(eq(schema.adminInvites.id, inviteId));
  if (approve) await sendAdminInvite(inviteId);
  refresh();
  return { ok: approve ? "Approved. The invite email is on its way." : "Declined." };
}

/** Disables or re-enables an admin (Super Admin only, F12). */
export async function setAdminDisabledAction(adminId: string, disabled: boolean): Promise<FormState> {
  const me = await assertSuperAdmin();
  id.parse(adminId);
  if (adminId === me.id) return { error: "The Super Admin can't be disabled." };
  const db = await getDb();
  await db
    .update(schema.users)
    .set({ disabled })
    .where(and(eq(schema.users.id, adminId), eq(schema.users.role, "admin"), eq(schema.users.isSuperAdmin, false)));
  if (disabled) {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, adminId));
    await db.update(schema.teamProfiles).set({ visible: false }).where(eq(schema.teamProfiles.userId, adminId));
    // Remove them from their clients; anyone left without an admin gets the Super Admin.
    const theirs = await db
      .delete(schema.clientAdmins)
      .where(eq(schema.clientAdmins.adminId, adminId))
      .returning({ clientId: schema.clientAdmins.clientId });
    for (const { clientId } of theirs) {
      const rest = await db.select().from(schema.clientAdmins).where(eq(schema.clientAdmins.clientId, clientId));
      if (rest.length === 0) await db.insert(schema.clientAdmins).values({ clientId, adminId: me.id });
    }
  }
  refresh();
  return { ok: disabled ? "Disabled." : "Enabled." };
}

// ---------- Team profiles (F14) ----------

async function canEditProfile(me: CurrentUser, userId: string) {
  if (me.id !== userId && !me.isSuperAdmin) throw new Error("You can only edit your own profile");
}

export async function updateProfileAction(userId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await assertAdmin();
  id.parse(userId);
  await canEditProfile(me, userId);
  const parsed = z
    .object({
      displayName: z.string().trim().min(1, "Enter a display name.").max(100),
      roleTitle: z.string().trim().max(100),
      bio: z.string().trim().max(1200, "Keep the bio under 1,200 characters."),
      yearsExperience: z
        .string()
        .trim()
        .regex(/^\d{0,2}$/, "Enter years as a number.")
        .transform((v) => (v ? Number(v) : null)),
      specialties: z.string().trim().max(300),
      visible: z.boolean(),
    })
    .safeParse({
      displayName: form.get("displayName"),
      roleTitle: form.get("roleTitle") ?? "",
      bio: form.get("bio") ?? "",
      yearsExperience: form.get("yearsExperience") ?? "",
      specialties: form.get("specialties") ?? "",
      visible: form.get("visible") === "on",
    });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db
    .insert(schema.teamProfiles)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: schema.teamProfiles.userId, set: parsed.data });
  refresh();
  return { ok: "Saved." };
}

/** Moves a profile up or down on the team page (Super Admin only). */
export async function moveProfileAction(userId: string, direction: -1 | 1) {
  await assertSuperAdmin();
  id.parse(userId);
  const db = await getDb();
  const rows = await db.select().from(schema.teamProfiles).orderBy(asc(schema.teamProfiles.sortOrder));
  const i = rows.findIndex((r) => r.userId === userId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (let k = 0; k < rows.length; k++) {
    await db.update(schema.teamProfiles).set({ sortOrder: k }).where(eq(schema.teamProfiles.userId, rows[k].userId));
  }
  refresh();
}

// ---------- Settings ----------

export async function updateEmailPrefsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await assertAdmin();
  const db = await getDb();
  await db
    .update(schema.users)
    .set({
      emailPrefs: {
        messages: form.get("messages") === "on",
        activity: form.get("activity") === "on",
        bookings: form.get("bookings") === "on",
      },
    })
    .where(eq(schema.users.id, me.id));
  refresh();
  return { ok: "Saved." };
}

export async function updateStudioSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSuperAdmin();
  const parsed = z
    .object({
      timeZone: z.string().refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Enter a time zone like America/Los_Angeles."),
      bufferMinutes: z.coerce.number().int().min(0).max(240),
      cancelCutoffHours: z.coerce.number().int().min(0).max(720),
      digestDelayMinutes: z.coerce.number().int().min(0).max(1440),
    })
    .safeParse({
      timeZone: String(form.get("timeZone") ?? "").trim(),
      bufferMinutes: form.get("bufferMinutes"),
      cancelCutoffHours: form.get("cancelCutoffHours"),
      digestDelayMinutes: form.get("digestDelayMinutes"),
    });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db
    .insert(schema.studioSettings)
    .values({ id: 1, ...parsed.data })
    .onConflictDoUpdate({ target: schema.studioSettings.id, set: parsed.data });
  refresh();
  return { ok: "Saved." };
}

// ---------- Session types and availability (F15) ----------

const sessionTypeFields = z.object({
  name: z.string().trim().min(1, "Name the session type.").max(100),
  durationMinutes: z.coerce.number().int().min(15, "Sessions are at least 15 minutes.").max(720),
  description: z.string().trim().max(500),
});

export async function createSessionTypeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = sessionTypeFields.safeParse({
    name: form.get("name"),
    durationMinutes: form.get("durationMinutes"),
    description: form.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.sessionTypes.sortOrder}), 0)::int` })
    .from(schema.sessionTypes);
  await db.insert(schema.sessionTypes).values({ ...parsed.data, sortOrder: max + 1 });
  refresh();
  return { ok: "Added." };
}

export async function setSessionTypeActiveAction(sessionTypeId: string, active: boolean) {
  await assertAdmin();
  id.parse(sessionTypeId);
  const db = await getDb();
  await db.update(schema.sessionTypes).set({ active }).where(eq(schema.sessionTypes.id, sessionTypeId));
  refresh();
}

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use times like 09:00.");

/** Replaces an admin's weekly hours. Admins edit their own; the Super Admin can edit anyone's. */
export async function saveHoursAction(adminId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await assertAdmin();
  id.parse(adminId);
  if (adminId !== me.id && !me.isSuperAdmin) return { error: "You can only change your own hours." };
  const rules: { weekday: number; startTime: string; endTime: string }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (form.get(`on${weekday}`) !== "on") continue;
    const start = hm.safeParse(form.get(`start${weekday}`));
    const end = hm.safeParse(form.get(`end${weekday}`));
    if (!start.success || !end.success) return { error: "Use times like 09:00." };
    if (end.data <= start.data) return { error: "Each day's end time must be after its start time." };
    rules.push({ weekday, startTime: start.data, endTime: end.data });
  }
  const db = await getDb();
  await db.delete(schema.availabilityRules).where(eq(schema.availabilityRules.adminId, adminId));
  if (rules.length) await db.insert(schema.availabilityRules).values(rules.map((r) => ({ ...r, adminId })));
  refresh();
  return { ok: "Hours saved." };
}

export async function addTimeOffAction(adminId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await assertAdmin();
  id.parse(adminId);
  if (adminId !== me.id && !me.isSuperAdmin) return { error: "You can only change your own time off." };
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
  const start = date.safeParse(form.get("startDate"));
  const end = date.safeParse(form.get("endDate") || form.get("startDate"));
  if (!start.success || !end.success) return { error: "Pick a date." };
  if (end.data < start.data) return { error: "The last day must be on or after the first day." };
  const db = await getDb();
  await db.insert(schema.timeOff).values({
    adminId,
    startDate: start.data,
    endDate: end.data,
    note: String(form.get("note") ?? "").trim().slice(0, 200),
  });
  refresh();
  return { ok: "Time off added." };
}

export async function removeTimeOffAction(timeOffId: string) {
  const me = await assertAdmin();
  id.parse(timeOffId);
  const db = await getDb();
  await db
    .delete(schema.timeOff)
    .where(and(eq(schema.timeOff.id, timeOffId), me.isSuperAdmin ? undefined : eq(schema.timeOff.adminId, me.id)));
  refresh();
}

// ---------- Bookings, admin side (F15) ----------

export async function adminCancelBookingAction(bookingId: string): Promise<FormState> {
  await assertAdmin();
  id.parse(bookingId);
  const db = await getDb();
  const [booking] = await db
    .update(schema.bookings)
    .set({ status: "cancelled" })
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, "confirmed")))
    .returning();
  if (!booking) return { error: "This booking was already cancelled." };
  const { timeZone } = await getSettings();
  await notifyClient(
    booking.clientId,
    "booking",
    `Your ${booking.sessionName} on ${formatWhen(booking.startsAt, timeZone)} is cancelled`,
    `The studio cancelled your ${booking.sessionName} on ${formatWhen(booking.startsAt, timeZone)}. ` +
      `Reply in your messages if you'd like to find another time.`,
  );
  refresh();
  return { ok: "Cancelled. The client has been emailed." };
}

/** Admins can move any booking to any time and person; no availability check (they know the calendar). */
export async function adminRescheduleBookingAction(bookingId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(bookingId);
  const parsed = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."), time: hm, adminId: id })
    .safeParse({ date: form.get("date"), time: form.get("time"), adminId: form.get("adminId") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
  if (!booking || booking.status !== "confirmed") return { error: "This booking isn't active." };
  const { timeZone } = await getSettings();
  const startsAt = zonedToUtc(parsed.data.date, parsed.data.time, timeZone);
  const endsAt = new Date(startsAt.getTime() + (booking.endsAt.getTime() - booking.startsAt.getTime()));
  await db
    .update(schema.bookings)
    .set({ startsAt, endsAt, adminId: parsed.data.adminId })
    .where(eq(schema.bookings.id, bookingId));
  if (booking.pageId) {
    await db.update(schema.clientPages).set({ shootDate: parsed.data.date }).where(eq(schema.clientPages.id, booking.pageId));
  }
  await db.insert(schema.clientAdmins).values({ clientId: booking.clientId, adminId: parsed.data.adminId }).onConflictDoNothing();
  await notifyClient(
    booking.clientId,
    "booking",
    `Your ${booking.sessionName} has moved to ${formatWhen(startsAt, timeZone)}`,
    `The studio moved your ${booking.sessionName} to ${formatWhen(startsAt, timeZone)}.`,
  );
  refresh();
  return { ok: "Moved. The client has been emailed." };
}
