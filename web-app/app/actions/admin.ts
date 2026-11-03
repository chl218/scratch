"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray, isNotNull, isNull, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { setPhotoTags, setShootPhotoTags } from "@/lib/data";
import { baseUsername, parseTags, USERNAME_PATTERN } from "@/lib/shared";
import { uniqueUsername } from "@/lib/username";
import * as storage from "@/lib/storage";
import { appUrl, hashToken, newToken } from "@/lib/tokens";
import { notifyClient, notifyNewShootPhotos, pageLinkFor, PRODUCT } from "@/lib/notify";
import type { FormState } from "./auth";

const id = z.string().uuid();

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

// ---------- Library (F1) ----------

const photoFields = z.object({
  title: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
  tags: z.string().max(1000),
  credit: z.string().trim().max(200),
  sourceUrl: z.union([z.literal(""), z.string().trim().url("Enter a full web address, starting with https://").max(1000)]),
  inPortfolio: z.boolean(),
  focusX: z.coerce.number().int().min(0).max(100),
  focusY: z.coerce.number().int().min(0).max(100),
});

export async function updatePhotoAction(photoId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = photoFields.safeParse({
    title: form.get("title") ?? "",
    notes: form.get("notes") ?? "",
    tags: form.get("tags") ?? "",
    credit: form.get("credit") ?? "",
    sourceUrl: String(form.get("sourceUrl") ?? "").trim(),
    inPortfolio: form.get("inPortfolio") === "on",
    focusX: form.get("focusX") ?? 50,
    focusY: form.get("focusY") ?? 50,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!id.safeParse(photoId).success) return { error: "Picture not found." };
  const { tags, ...fields } = parsed.data;
  if (fields.inPortfolio && fields.credit) {
    return { error: "Pictures with a credit aren't the studio's work, so they can't go in the portfolio." };
  }

  const db = await getDb();
  await db.update(schema.photos).set(fields).where(eq(schema.photos.id, photoId));
  await setPhotoTags(photoId, parseTags(tags));
  refresh();
  return { ok: "Saved." };
}

/** Client pages that use a library picture, for the delete confirmation (F1). */
export async function pagesUsingPhotoAction(photoId: string): Promise<string[]> {
  await assertAdmin();
  id.parse(photoId);
  const db = await getDb();
  const rows = await db
    .select({ title: schema.clientPages.title, client: schema.clients.name })
    .from(schema.referencePictures)
    .innerJoin(schema.clientPages, eq(schema.clientPages.id, schema.referencePictures.pageId))
    .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
    .where(eq(schema.referencePictures.photoId, photoId));
  return rows.map((r) => `${r.client} – ${r.title}`);
}

/**
 * Deletes a library picture (F1). Its rows and comments go from boards that aren't
 * locked; on locked pages an Accepted row stays as a name-only record.
 */
export async function deletePhotoAction(photoId: string) {
  await assertAdmin();
  id.parse(photoId);
  const db = await getDb();
  const keep = db
    .select({ id: schema.referencePictures.id })
    .from(schema.referencePictures)
    .innerJoin(schema.clientPages, eq(schema.clientPages.id, schema.referencePictures.pageId))
    .where(
      and(
        eq(schema.referencePictures.photoId, photoId),
        eq(schema.clientPages.shootPhotosVisible, true),
        eq(schema.referencePictures.state, "accepted"),
      ),
    );
  await db
    .delete(schema.comments)
    .where(inArray(schema.comments.referencePictureId, keep));
  await db
    .delete(schema.referencePictures)
    .where(and(eq(schema.referencePictures.photoId, photoId), notInArray(schema.referencePictures.id, keep)));
  await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
  await setPhotoTags(photoId, []);
  await storage.remove(`library/${photoId}`);
  refresh();
}

// ---------- Clients & accounts (F9, F12, F17) ----------

export async function createClientAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await assertAdmin();
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

  const username = await uniqueUsername(baseUsername(parsed.data.name));
  const [client] = await db.insert(schema.clients).values({ ...parsed.data, username }).returning();
  await db.insert(schema.clientAdmins).values({ clientId: client.id, adminId: admin.id });
  redirect(`/admin/clients/${client.id}`);
}

export async function updateClientAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter the client's name.").max(100),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(USERNAME_PATTERN, "Use lowercase letters a–z, optionally followed by a number, e.g. jdoe2."),
    })
    .safeParse({ name: form.get("name"), username: form.get("username") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [taken] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.username, parsed.data.username), ne(schema.clients.id, clientId)));
  if (taken) return { error: `${parsed.data.username} is taken. Try ${await uniqueUsername(parsed.data.username, clientId)}.` };
  await db.update(schema.clients).set(parsed.data).where(eq(schema.clients.id, clientId));
  refresh();
  return { ok: "Saved." };
}

export async function assignAdminAction(clientId: string, adminId: string) {
  await assertAdmin();
  id.parse(clientId);
  id.parse(adminId);
  const db = await getDb();
  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, adminId), eq(schema.users.role, "admin"), eq(schema.users.disabled, false)));
  if (!admin) return;
  await db.insert(schema.clientAdmins).values({ clientId, adminId }).onConflictDoNothing();
  refresh();
}

export async function unassignAdminAction(clientId: string, adminId: string): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  id.parse(adminId);
  const db = await getDb();
  const rows = await db.select().from(schema.clientAdmins).where(eq(schema.clientAdmins.clientId, clientId));
  if (rows.length <= 1) return { error: "A client needs at least one assigned admin." };
  await db
    .delete(schema.clientAdmins)
    .where(and(eq(schema.clientAdmins.clientId, clientId), eq(schema.clientAdmins.adminId, adminId)));
  refresh();
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
    `You're invited to ${PRODUCT}`,
    `The studio has invited you to create an account. With it you can comment on photos, message the studio and book shoots.\n\n` +
      `Set your password here (the link works for 7 days):\n${appUrl(`/invite/${token}`)}\n\n` +
      "You don't need an account to choose references or download your photos: your private links keep working either way.",
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
  title: z.string().trim().min(1, 'Give the page a name, e.g. "Engagement shoot".').max(200),
  shootDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date.")
    .transform((v) => v || null),
  notes: z.string().trim().max(5000),
  favouritesLimit: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "Enter a whole number, or leave it empty for no limit.")
    .transform((v) => (v ? Number(v) : null)),
});

function readPageForm(form: FormData) {
  return pageFields.safeParse({
    title: form.get("title"),
    shootDate: form.get("shootDate") ?? "",
    notes: form.get("notes") ?? "",
    favouritesLimit: form.get("favouritesLimit") ?? "",
  });
}

export async function createPageAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(clientId);
  const parsed = readPageForm(form);
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
  const parsed = readPageForm(form);
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

export async function markPageSeenAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  await db.update(schema.clientPages).set({ adminSeenAt: new Date() }).where(eq(schema.clientPages.id, pageId));
}

export async function addReferencesAction(pageId: string, photoIds: string[]): Promise<FormState> {
  await assertAdmin();
  id.parse(pageId);
  const ids = z.array(id).max(500).parse(photoIds);
  if (ids.length === 0) return;

  const db = await getDb();
  const [page] = await db.select().from(schema.clientPages).where(eq(schema.clientPages.id, pageId));
  if (!page) return { error: "Page not found." };
  // Pictures hidden earlier come back instead of being added twice.
  const unhidden = await db
    .update(schema.referencePictures)
    .set({ hiddenAt: null })
    .where(
      and(
        eq(schema.referencePictures.pageId, pageId),
        inArray(schema.referencePictures.photoId, ids),
        isNotNull(schema.referencePictures.hiddenAt),
      ),
    )
    .returning({ id: schema.referencePictures.id });
  const added = await db
    .insert(schema.referencePictures)
    .values(ids.map((photoId) => ({ pageId, photoId, addedBy: "admin" as const })))
    .onConflictDoNothing()
    .returning({ id: schema.referencePictures.id });

  // One email per batch (F7).
  const n = added.length + unhidden.length;
  if (n > 0) {
    await notifyClient(
      page.clientId,
      "references",
      `New reference pictures for "${page.title}"`,
      `${n} new reference picture${n === 1 ? " was" : "s were"} added to "${page.title}". ` +
        `Have a look and accept the ones you like:\n${await pageLinkFor(page)}`,
    );
  }
  refresh();
  return { ok: `Added ${n} picture${n === 1 ? "" : "s"}.` };
}

/** Takes a picture off one page (F3). It stays in the library and can be added back. */
export async function setReferenceHiddenAction(referenceId: string, hidden: boolean) {
  await assertAdmin();
  id.parse(referenceId);
  const db = await getDb();
  await db
    .update(schema.referencePictures)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(eq(schema.referencePictures.id, referenceId));
  refresh();
}

/**
 * Shows or hides Your Photos (F6). Showing it locks the page: Accepted pictures are
 * snapshotted and the Board is hidden from the client. Hiding it unlocks the page.
 */
export async function setShootVisibilityAction(pageId: string, visible: boolean) {
  await assertAdmin();
  id.parse(pageId);
  const db = await getDb();
  if (visible) {
    const accepted = await db
      .select({ ref: schema.referencePictures, photo: schema.photos })
      .from(schema.referencePictures)
      .innerJoin(schema.photos, eq(schema.photos.id, schema.referencePictures.photoId))
      .where(
        and(
          eq(schema.referencePictures.pageId, pageId),
          eq(schema.referencePictures.state, "accepted"),
          isNull(schema.referencePictures.hiddenAt),
        ),
      );
    const tagRows = accepted.length
      ? await db
          .select({ photoId: schema.photoTags.photoId, name: schema.tags.name })
          .from(schema.photoTags)
          .innerJoin(schema.tags, eq(schema.tags.id, schema.photoTags.tagId))
          .where(inArray(schema.photoTags.photoId, accepted.map((a) => a.photo.id)))
      : [];
    for (const { ref, photo } of accepted) {
      await db
        .update(schema.referencePictures)
        .set({
          snapshotFilename: photo.filename,
          snapshotTitle: photo.title,
          snapshotTags: tagRows.filter((t) => t.photoId === photo.id).map((t) => t.name),
          acceptedAt: ref.acceptedAt ?? new Date(),
        })
        .where(eq(schema.referencePictures.id, ref.id));
    }
  }
  await db
    .update(schema.clientPages)
    .set({ shootPhotosVisible: visible, lockedAt: visible ? new Date() : null })
    .where(eq(schema.clientPages.id, pageId));
  // Making the section visible tells the client about photos they haven't heard about (F7).
  if (visible) await notifyNewShootPhotos(pageId);
  refresh();
}

/** Called once after a batch of Shoot Photos finishes uploading, so the client gets one email. */
export async function finishShootUploadAction(pageId: string) {
  await assertAdmin();
  id.parse(pageId);
  await notifyNewShootPhotos(pageId);
  refresh();
}

export async function updateShootPhotoAction(shootPhotoId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await assertAdmin();
  id.parse(shootPhotoId);
  const parsed = z
    .object({
      tags: z.string().max(1000),
      inPortfolio: z.boolean(),
      focusX: z.coerce.number().int().min(0).max(100),
      focusY: z.coerce.number().int().min(0).max(100),
    })
    .safeParse({
      tags: form.get("tags") ?? "",
      inPortfolio: form.get("inPortfolio") === "on",
      focusX: form.get("focusX") ?? 50,
      focusY: form.get("focusY") ?? 50,
    });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { tags, ...fields } = parsed.data;
  const db = await getDb();
  await db.update(schema.shootPhotos).set(fields).where(eq(schema.shootPhotos.id, shootPhotoId));
  await setShootPhotoTags(shootPhotoId, parseTags(tags));
  refresh();
  return { ok: "Saved." };
}

export async function deleteShootPhotoAction(shootPhotoId: string) {
  await assertAdmin();
  id.parse(shootPhotoId);
  const db = await getDb();
  const [row] = await db.delete(schema.shootPhotos).where(eq(schema.shootPhotos.id, shootPhotoId)).returning();
  if (row) await storage.remove(`shoots/${row.pageId}/${row.id}`);
  refresh();
}

// ---------- Messaging (F10, F16) ----------

export async function adminSendMessageAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  id.parse(clientId);
  const body = z.string().trim().min(1).max(5000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };

  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) return { error: "Client not found." };
  await db.insert(schema.messages).values({ clientId, sender: "admin", senderUserId: admin.id, body: body.data });
  await notifyClient(
    clientId,
    "message",
    `New message from ${admin.name} at the studio`,
    `${admin.name} wrote:\n\n"${body.data.slice(0, 500)}"\n\nReply here: ${appUrl(`/u/${client.username}/messages`)}`,
  );
  refresh();
  return { ok: "Sent." };
}

export async function setContactHandledAction(contactId: string, handled: boolean) {
  await assertAdmin();
  id.parse(contactId);
  const db = await getDb();
  await db
    .update(schema.contactMessages)
    .set({ handledAt: handled ? new Date() : null })
    .where(eq(schema.contactMessages.id, contactId));
  refresh();
}

/** Library search for the admin's "Add from library" picker. */
export async function adminSearchLibraryAction(query: string) {
  await assertAdmin();
  const { allTags, searchPhotos } = await import("@/lib/data");
  const tags = parseTags(z.string().max(500).parse(query));
  const [photos, tagList] = await Promise.all([searchPhotos(tags, 300), allTags()]);
  return { photos, tags: tagList };
}
