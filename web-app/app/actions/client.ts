"use server";

// Actions for clients (client area, messages, booking) and the public contact form.

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { resolveArea } from "@/lib/area";
import { allTags, savedReferences, searchPhotos, type LibraryPhoto, type SavedReference } from "@/lib/data";
import { notifyAllAdmins, notifyClient, notifyClientAdmins, PRODUCT } from "@/lib/notify";
import { getSettings, pickAnyone, slotsForDay } from "@/lib/booking";
import { formatWhen, zonedDate } from "@/lib/time";
import { appUrl, hashToken, newToken } from "@/lib/tokens";
import { parseTags } from "@/lib/shared";
import type { FormState } from "./auth";

const id = z.string().uuid();

async function currentClient() {
  const found = await getCurrentClient();
  if (!found) throw new Error("Not logged in");
  return found.client;
}

// ---------- Messages (F10) ----------

export async function clientSendMessageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const found = await getCurrentClient();
  if (!found) return { error: "Log in to send messages." };
  const { client, user } = found;
  const body = z.string().trim().min(1).max(5000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };

  const db = await getDb();
  await db.insert(schema.messages).values({ clientId: client.id, sender: "client", senderUserId: user.id, body: body.data });
  await notifyClientAdmins(
    client.id,
    "messages",
    "message",
    `New message from ${client.name}`,
    `${client.name} wrote:\n\n"${body.data.slice(0, 500)}"\n\nReply here: ${appUrl(`/admin/inbox/${client.id}`)}`,
  );
  refresh();
  return { ok: "Sent." };
}

// ---------- Library search in the client area (F4) ----------

export async function searchLibraryAction(
  username: string,
  query: string,
): Promise<{ photos: LibraryPhoto[]; saved: SavedReference[]; tags: { name: string; count: number }[] }> {
  const area = await resolveArea(z.string().max(40).parse(username));
  if (!area) throw new Error("Not found");
  const tags = parseTags(z.string().max(500).parse(query));
  const [photos, saved, tagList] = await Promise.all([searchPhotos(tags, 300), savedReferences(area.client.id, tags), allTags()]);
  // Clients only need what the grid shows.
  return { photos: photos.map((p) => ({ ...p, notes: "", sourceUrl: "" })), saved, tags: tagList };
}

// ---------- Booking (F15) ----------

const bookingInput = z.object({
  sessionTypeId: id,
  start: z.string().datetime(),
  adminId: z.union([id, z.literal("any")]),
});

/** Finds the slot again on the server, so a stale page can't book a taken time. */
async function claimSlot(input: z.infer<typeof bookingInput>, durationMinutes: number, excludeBookingId?: string) {
  const settings = await getSettings();
  const ymd = zonedDate(new Date(input.start), settings.timeZone);
  const slots = await slotsForDay(ymd, durationMinutes, { excludeBookingId });
  const slot = slots.find((s) => s.start === new Date(input.start).toISOString());
  if (!slot) return null;
  const admin =
    input.adminId === "any"
      ? await pickAnyone(slot.start, slot.free, settings)
      : slot.free.find((f) => f.id === input.adminId);
  if (!admin) return null;
  return { slot, admin, settings, ymd };
}

export async function bookAction(input: z.infer<typeof bookingInput>): Promise<{ error?: string }> {
  const found = await getCurrentClient();
  if (!found) return { error: "Log in to book." };
  const { client } = found;
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) return { error: "Pick a session, a day and a time." };
  const db = await getDb();
  const [type] = await db
    .select()
    .from(schema.sessionTypes)
    .where(and(eq(schema.sessionTypes.id, parsed.data.sessionTypeId), eq(schema.sessionTypes.active, true)));
  if (!type) return { error: "That session type isn't available any more." };
  const claimed = await claimSlot(parsed.data, type.durationMinutes);
  if (!claimed) return { error: "That time was just taken. Pick another one." };
  const { slot, admin, settings, ymd } = claimed;

  const startsAt = new Date(slot.start);
  const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60000);
  const [page] = await db
    .insert(schema.clientPages)
    .values({ clientId: client.id, title: `${type.name} – ${ymd}`, shootDate: ymd, linkToken: newToken() })
    .returning();
  await db.insert(schema.bookings).values({
    clientId: client.id,
    adminId: admin.id,
    sessionTypeId: type.id,
    sessionName: type.name,
    startsAt,
    endsAt,
    pageId: page.id,
  });
  await db.insert(schema.clientAdmins).values({ clientId: client.id, adminId: admin.id }).onConflictDoNothing();

  const when = formatWhen(startsAt, settings.timeZone);
  await notifyClient(
    client.id,
    "booking",
    `Booked: ${type.name} on ${when}`,
    `Your ${type.name} with ${admin.name} is confirmed for ${when}.\n\n` +
      `Your shoot page is ready for choosing reference pictures:\n${appUrl(`/c/${page.linkToken}`)}\n\n` +
      `You can reschedule or cancel from ${appUrl(`/u/${client.username}/bookings`)} up to ${settings.cancelCutoffHours} hours before.`,
  );
  await notifyClientAdmins(
    client.id,
    "bookings",
    "booking",
    `New booking: ${client.name}, ${type.name} on ${when}`,
    `${client.name} booked a ${type.name} with ${admin.name} on ${when}.\n\nClient page: ${appUrl(`/admin/pages/${page.id}`)}\n`,
  );
  redirect(`/u/${client.username}/bookings?booked=1`);
}

async function ownBooking(bookingId: string) {
  const client = await currentClient();
  id.parse(bookingId);
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.clientId, client.id)));
  const settings = await getSettings();
  const open =
    booking?.status === "confirmed" &&
    booking.startsAt.getTime() - Date.now() > settings.cancelCutoffHours * 3600 * 1000;
  return { client, booking, settings, open };
}

export async function rescheduleBookingAction(bookingId: string, input: z.infer<typeof bookingInput>): Promise<{ error?: string }> {
  const { client, booking, open } = await ownBooking(bookingId);
  if (!booking || !open) return { error: "This booking can't be changed online any more. Message the studio instead." };
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) return { error: "Pick a day and a time." };
  const duration = (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000;
  const claimed = await claimSlot(parsed.data, duration, booking.id);
  if (!claimed) return { error: "That time was just taken. Pick another one." };
  const { slot, admin, settings, ymd } = claimed;
  const startsAt = new Date(slot.start);
  const db = await getDb();
  await db
    .update(schema.bookings)
    .set({ startsAt, endsAt: new Date(startsAt.getTime() + duration * 60000), adminId: admin.id })
    .where(eq(schema.bookings.id, booking.id));
  if (booking.pageId) {
    const oldTitle = `${booking.sessionName} – ${zonedDate(booking.startsAt, settings.timeZone)}`;
    const [page] = await db.select().from(schema.clientPages).where(eq(schema.clientPages.id, booking.pageId));
    await db
      .update(schema.clientPages)
      .set({ shootDate: ymd, title: page?.title === oldTitle ? `${booking.sessionName} – ${ymd}` : page?.title })
      .where(eq(schema.clientPages.id, booking.pageId));
  }
  await db.insert(schema.clientAdmins).values({ clientId: client.id, adminId: admin.id }).onConflictDoNothing();
  const when = formatWhen(startsAt, settings.timeZone);
  await notifyClient(client.id, "booking", `Moved: ${booking.sessionName} on ${when}`, `Your ${booking.sessionName} with ${admin.name} is now on ${when}.`);
  await notifyClientAdmins(
    client.id,
    "bookings",
    "booking",
    `${client.name} moved their ${booking.sessionName}`,
    `${client.name} moved their ${booking.sessionName} from ${formatWhen(booking.startsAt, settings.timeZone)} to ${when} (with ${admin.name}).\n`,
  );
  redirect(`/u/${client.username}/bookings?moved=1`);
}

export async function cancelBookingAction(bookingId: string): Promise<FormState> {
  const { client, booking, settings, open } = await ownBooking(bookingId);
  if (!booking || !open) return { error: "This booking can't be cancelled online any more. Message the studio instead." };
  const db = await getDb();
  await db.update(schema.bookings).set({ status: "cancelled" }).where(eq(schema.bookings.id, booking.id));
  const when = formatWhen(booking.startsAt, settings.timeZone);
  await notifyClient(client.id, "booking", `Cancelled: ${booking.sessionName} on ${when}`, `Your ${booking.sessionName} on ${when} is cancelled.`);
  await notifyClientAdmins(
    client.id,
    "bookings",
    "booking",
    `${client.name} cancelled their ${booking.sessionName}`,
    `${client.name} cancelled their ${booking.sessionName} on ${when}.\n`,
  );
  refresh();
  return { ok: "Cancelled." };
}

// ---------- Contact form (F16) ----------

const HOURLY_LIMIT = 5;

export async function contactAction(_prev: FormState, form: FormData): Promise<FormState> {
  // The hidden "website" field is a trap for bots; people never see it.
  if (String(form.get("website") ?? "") !== "") return { ok: "Thanks! The studio will get back to you." };

  const found = await getCurrentClient();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter your name.").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      body: z.string().trim().min(1, "Write a message.").max(5000),
    })
    .safeParse({
      name: found ? found.client.name : form.get("name"),
      email: found ? found.client.email : form.get("email"),
      body: form.get("body"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = await getDb();

  // A logged-in client's note goes into their conversation instead (F10).
  if (found) {
    await db
      .insert(schema.messages)
      .values({ clientId: found.client.id, sender: "client", senderUserId: found.user.id, body: parsed.data.body });
    await notifyClientAdmins(
      found.client.id,
      "messages",
      "message",
      `New message from ${found.client.name}`,
      `${found.client.name} wrote:\n\n"${parsed.data.body.slice(0, 500)}"\n\nReply here: ${appUrl(`/admin/inbox/${found.client.id}`)}`,
    );
    return { ok: "Sent. You'll find the reply in your messages." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const ipHash = hashToken(`contact:${ip}`);
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.contactMessages)
    .where(and(eq(schema.contactMessages.ipHash, ipHash), gt(schema.contactMessages.createdAt, new Date(Date.now() - 3600_000))));
  if (n >= HOURLY_LIMIT) return { error: "Too many messages from this connection. Try again in an hour, or email the studio." };

  await db.insert(schema.contactMessages).values({ ...parsed.data, ipHash });
  await notifyAllAdmins(
    "messages",
    "contact",
    `Contact form: ${parsed.data.name}`,
    `${parsed.data.name} (${parsed.data.email}) wrote through the ${PRODUCT} contact form:\n\n${parsed.data.body}\n\n` +
      `Contact inbox: ${appUrl("/admin/inbox?tab=contact")}\n`,
  );
  return { ok: "Thanks! The studio will get back to you by email." };
}
