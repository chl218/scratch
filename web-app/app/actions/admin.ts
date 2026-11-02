"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { setPhotoTags } from "@/lib/data";
import { parseTags } from "@/lib/shared";
import * as storage from "@/lib/storage";
import { appUrl, hashToken, newToken } from "@/lib/tokens";
import { notifyClient, notifyNewShootPhotos, pageLinkFor } from "@/lib/notify";
import { formatMoney } from "@/lib/payments";
import type { FormState } from "./auth";

const id = z.string().uuid();

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Please check the form.";
}

// ---------- Library (F1) ----------

export async function updatePhotoAction(photoId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = z
    .object({
      title: z.string().trim().max(200),
      notes: z.string().trim().max(2000),
      tags: z.string().max(1000),
    })
    .safeParse({ title: form.get("title") ?? "", notes: form.get("notes") ?? "", tags: form.get("tags") ?? "" });
  if (!parsed.success || !id.safeParse(photoId).success) return { error: "Please check the form." };

  const db = await getDb();
  await db
    .update(schema.photos)
    .set({ title: parsed.data.title, notes: parsed.data.notes })
    .where(eq(schema.photos.id, photoId));
  await setPhotoTags(photoId, parseTags(parsed.data.tags));
  refresh();
  return { ok: "Saved." };
}

export async function deletePhotoAction(photoId: string) {
  await assertAdmin();
  id.parse(photoId);
  const db = await getDb();
  await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
  await setPhotoTags(photoId, []);
  await storage.remove(`library/${photoId}`);
  refresh();
}

// ---------- Clients & accounts (F9) ----------

export async function createClientAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter the client's name.").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    })
    .safeParse({ name: form.get("name"), email: form.get("email") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.email, parsed.data.email));
  if (existing) return { error: "A client with this email already exists." };

  const [client] = await db.insert(schema.clients).values(parsed.data).returning();
  redirect(`/admin/clients/${client.id}`);
}

export async function sendInviteAction(clientId: string): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) return { error: "Client not found." };
  if (client.userId) return { error: "This client already has an account." };

  const token = newToken();
  await db.insert(schema.accountTokens).values({
    id: hashToken(token),
    purpose: "invite",
    clientId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await notifyClient(
    clientId,
    "account",
    "You're invited to Moodboard",
    "Your photographer has invited you to create a Moodboard account, where you can message them and pay invoices.\n\n" +
      `Set your password here (the link works for 7 days):\n${appUrl(`/invite/${token}`)}\n\n` +
      "You don't need an account to choose photos: your private shoot links keep working either way.",
  );
  return { ok: "Invite sent." };
}

export async function setClientDisabledAction(clientId: string, disabled: boolean) {
  await assertAdmin();
  id.parse(clientId);
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client?.userId) return;
  await db.update(schema.users).set({ disabled }).where(eq(schema.users.id, client.userId));
  if (disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, client.userId));
  refresh();
}

// ---------- Client pages (F3, F6) ----------

const pageFields = z.object({
  title: z.string().trim().min(1, "Give the page a name, e.g. \"Engagement shoot\".").max(200),
  shootDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date.")
    .transform((v) => v || null),
  notes: z.string().trim().max(5000),
});

export async function createPageAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const parsed = pageFields.safeParse({
    title: form.get("title"),
    shootDate: form.get("shootDate") ?? "",
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const [page] = await db
    .insert(schema.clientPages)
    .values({ clientId, ...parsed.data, linkToken: newToken() })
    .returning();
  redirect(`/admin/pages/${page.id}`);
}

export async function updatePageAction(pageId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(pageId);
  const parsed = pageFields.safeParse({
    title: form.get("title"),
    shootDate: form.get("shootDate") ?? "",
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db.update(schema.clientPages).set(parsed.data).where(eq(schema.clientPages.id, pageId));
  refresh();
  return { ok: "Saved." };
}

export async function regenerateLinkAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  await db.update(schema.clientPages).set({ linkToken: newToken() }).where(eq(schema.clientPages.id, pageId));
  refresh();
}

export async function revokeLinkAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  await db.update(schema.clientPages).set({ linkToken: null }).where(eq(schema.clientPages.id, pageId));
  refresh();
}

export async function deletePageAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  const [page] = await db.delete(schema.clientPages).where(eq(schema.clientPages.id, pageId)).returning();
  await storage.remove(`shoots/${pageId}`);
  redirect(page ? `/admin/clients/${page.clientId}` : "/admin/clients");
}

export async function addInspirationsAction(pageId: string, photoIds: string[]): Promise<FormState> {
  await assertAdmin();
  id.parse(pageId);
  const ids = z.array(id).max(500).parse(photoIds);
  if (ids.length === 0) return;

  const db = await getDb();
  const [page] = await db.select().from(schema.clientPages).where(eq(schema.clientPages.id, pageId));
  if (!page) return { error: "Page not found." };
  const added = await db
    .insert(schema.inspirations)
    .values(ids.map((photoId) => ({ pageId, photoId, addedBy: "admin" as const })))
    .onConflictDoNothing()
    .returning({ id: schema.inspirations.id });

  // One email per batch (F7).
  if (added.length > 0) {
    const n = added.length;
    await notifyClient(
      page.clientId,
      "inspirations",
      `New inspiration photos for "${page.title}"`,
      `${n} new inspiration photo${n === 1 ? " was" : "s were"} added to "${page.title}". ` +
        `Have a look and accept the ones you like:\n${pageLinkFor(page)}`,
    );
  }
  refresh();
  return { ok: `Added ${added.length} photo${added.length === 1 ? "" : "s"}.` };
}

export async function removeInspirationAction(inspirationId: string) {
  await assertAdmin();
  id.parse(inspirationId);
  const db = await getDb();
  await db.delete(schema.inspirations).where(eq(schema.inspirations.id, inspirationId));
  refresh();
}

export async function setShootVisibilityAction(pageId: string, visible: boolean) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  await db
    .update(schema.clientPages)
    .set({ shootPhotosVisible: visible })
    .where(eq(schema.clientPages.id, pageId));
  // Making the section visible tells the client about photos they haven't heard about (F7).
  if (visible) await notifyNewShootPhotos(pageId);
  refresh();
}

/** Called once after a batch of shoot photos finishes uploading, so the client gets one email. */
export async function finishShootUploadAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  await notifyNewShootPhotos(pageId);
  refresh();
}

export async function deleteShootPhotoAction(shootPhotoId: string) {
  await assertAdmin();
  id.parse(shootPhotoId);
  const db = await getDb();
  const [row] = await db
    .delete(schema.shootPhotos)
    .where(eq(schema.shootPhotos.id, shootPhotoId))
    .returning();
  if (row) await storage.remove(`shoots/${row.pageId}/${row.id}`);
  refresh();
}

// ---------- Messaging (F10) ----------

export async function adminSendMessageAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const body = z.string().trim().min(1).max(5000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };

  const db = await getDb();
  await db.insert(schema.messages).values({ clientId, sender: "admin", body: body.data });
  await notifyClient(
    clientId,
    "message",
    "New message from your photographer",
    `You have a new message:\n\n"${body.data.slice(0, 500)}"\n\nReply here: ${appUrl("/account/messages")}`,
  );
  refresh();
  return { ok: "Sent." };
}

// ---------- Payments (F11) ----------

export async function createPaymentAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const parsed = z
    .object({
      amount: z.coerce.number().positive("Enter an amount above zero.").max(1_000_000),
      currency: z.enum(["USD", "CAD", "EUR", "GBP", "AUD"]),
      description: z.string().trim().min(1, "Add a description, e.g. \"Deposit\".").max(200),
      pageId: z.union([id, z.literal("")]),
    })
    .safeParse({
      amount: form.get("amount"),
      currency: form.get("currency") ?? "USD",
      description: form.get("description"),
      pageId: form.get("pageId") ?? "",
    });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const { amount, currency, description, pageId } = parsed.data;
  if (pageId) {
    const [page] = await db
      .select({ id: schema.clientPages.id })
      .from(schema.clientPages)
      .where(and(eq(schema.clientPages.id, pageId), eq(schema.clientPages.clientId, clientId)));
    if (!page) return { error: "That page doesn't belong to this client." };
  }
  const amountCents = Math.round(amount * 100);
  await db.insert(schema.paymentRequests).values({
    clientId,
    pageId: pageId || null,
    amountCents,
    currency,
    description,
  });
  await notifyClient(
    clientId,
    "payment",
    `Payment request: ${description}`,
    `Your photographer has sent a payment request for ${formatMoney(amountCents, currency)} (${description}).\n\n` +
      `View it here: ${appUrl("/account/payments")}`,
  );
  refresh();
  return { ok: "Payment request sent." };
}

export async function setPaymentStatusAction(paymentId: string, status: "paid" | "cancelled" | "pending") {
  await assertAdmin();
  id.parse(paymentId);
  z.enum(["paid", "cancelled", "pending"]).parse(status);
  const db = await getDb();
  await db
    .update(schema.paymentRequests)
    .set({ status, paidAt: status === "paid" ? new Date() : null })
    .where(eq(schema.paymentRequests.id, paymentId));
  refresh();
}

