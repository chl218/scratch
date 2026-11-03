"use server";

// Actions on a client page. Each takes the page's access key ("t:<token>" for the
// private link, "p:<pageId>" for a logged-in client or an admin) and checks it.

import { refresh } from "next/cache";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { isLocked, resolvePageAccess, type PageAccess } from "@/lib/access";
import { commentsFor, type CommentView } from "@/lib/data";
import { recordActivity } from "@/lib/digest";
import { rememberToken } from "@/lib/links";

const id = z.string().uuid();
const target = z.union([z.object({ referencePictureId: id }), z.object({ shootPhotoId: id })]);
export type CommentTarget = z.infer<typeof target>;

/** Remembers that this browser opened a private link, for access to the client area (F17). */
export async function rememberLinkAction(token: string) {
  const access = await resolvePageAccess(`t:${z.string().max(100).parse(token)}`);
  if (access.actor.type === "client") await rememberToken(token);
}

/** Checks the comment target belongs to this page and is visible to a client. */
async function checkTarget(access: PageAccess, t: CommentTarget) {
  const db = await getDb();
  const client = access.actor.type === "client";
  if ("referencePictureId" in t) {
    if (client && isLocked(access.page)) throw new Error("Not found");
    const [row] = await db
      .select({ id: schema.referencePictures.id })
      .from(schema.referencePictures)
      .where(
        and(
          eq(schema.referencePictures.id, t.referencePictureId),
          eq(schema.referencePictures.pageId, access.page.id),
          client ? isNull(schema.referencePictures.hiddenAt) : undefined,
        ),
      );
    if (!row) throw new Error("Not found");
  } else {
    if (client && !access.page.shootPhotosVisible) throw new Error("Not found");
    const [row] = await db
      .select({ id: schema.shootPhotos.id })
      .from(schema.shootPhotos)
      .where(and(eq(schema.shootPhotos.id, t.shootPhotoId), eq(schema.shootPhotos.pageId, access.page.id)));
    if (!row) throw new Error("Not found");
  }
}

/** Accept / Reject / clear (F3). Saves immediately. */
export async function setReferenceStateAction(
  key: string,
  referenceId: string,
  state: "undecided" | "accepted" | "rejected",
): Promise<{ error?: string }> {
  const access = await resolvePageAccess(key);
  if (access.actor.type !== "client") return { error: "Only the client chooses references." };
  if (isLocked(access.page)) return { error: "This page is locked because your photos are ready." };
  id.parse(referenceId);
  z.enum(["undecided", "accepted", "rejected"]).parse(state);
  const db = await getDb();
  const updated = await db
    .update(schema.referencePictures)
    .set({ state, acceptedAt: state === "accepted" ? new Date() : null })
    .where(
      and(
        eq(schema.referencePictures.id, referenceId),
        eq(schema.referencePictures.pageId, access.page.id),
        isNull(schema.referencePictures.hiddenAt),
      ),
    )
    .returning({ id: schema.referencePictures.id });
  if (updated.length) await recordActivity(access.page.id, state);
  return {};
}

/** ♥ a Shoot Photo (F6). Link visitors can favourite too. */
export async function setFavouriteAction(
  key: string,
  shootPhotoId: string,
  favourite: boolean,
): Promise<{ error?: string }> {
  const access = await resolvePageAccess(key);
  if (access.actor.type !== "client") return { error: "Only the client picks favourites." };
  if (!access.page.shootPhotosVisible) return { error: "Not found" };
  id.parse(shootPhotoId);
  const db = await getDb();
  const limit = access.page.favouritesLimit;
  if (favourite && limit) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.shootPhotos)
      .where(and(eq(schema.shootPhotos.pageId, access.page.id), eq(schema.shootPhotos.favourite, true)));
    if (n >= limit) return { error: `You can choose up to ${limit}. Remove a ♥ to choose another.` };
  }
  const updated = await db
    .update(schema.shootPhotos)
    .set({ favourite })
    .where(and(eq(schema.shootPhotos.id, shootPhotoId), eq(schema.shootPhotos.pageId, access.page.id)))
    .returning({ id: schema.shootPhotos.id });
  if (updated.length) await recordActivity(access.page.id, "favourite");
  return {};
}

export async function getCommentsAction(key: string, t: CommentTarget): Promise<CommentView[]> {
  const access = await resolvePageAccess(key);
  const parsed = target.parse(t);
  await checkTarget(access, parsed);
  return commentsFor(access.page.id, parsed);
}

/** Comments need a login (F5): admins, or the logged-in client who owns the page. */
export async function addCommentAction(
  key: string,
  t: CommentTarget,
  body: string,
): Promise<{ comments?: CommentView[]; error?: string }> {
  const access = await resolvePageAccess(key);
  if (!access.actor.userId) return { error: "Log in to comment." };
  const parsed = target.parse(t);
  const text = z.string().trim().min(1).max(2000).parse(body);
  await checkTarget(access, parsed);
  const db = await getDb();
  await db.insert(schema.comments).values({
    pageId: access.page.id,
    referencePictureId: "referencePictureId" in parsed ? parsed.referencePictureId : null,
    shootPhotoId: "shootPhotoId" in parsed ? parsed.shootPhotoId : null,
    authorType: access.actor.type,
    authorUserId: access.actor.userId,
    authorName: access.actor.name,
    body: text,
  });
  if (access.actor.type === "client") await recordActivity(access.page.id, "comment");
  return { comments: await commentsFor(access.page.id, parsed) };
}

/** F4: the client adds library pictures to a page that isn't locked. No email is sent. */
export async function addFromLibraryAction(key: string, photoIds: string[]): Promise<{ error?: string; added?: number }> {
  const access = await resolvePageAccess(key);
  if (access.actor.type !== "client") return { error: "Not allowed." };
  if (isLocked(access.page)) return { error: "This page is locked because your photos are ready." };
  const ids = z.array(id).min(1).max(200).parse(photoIds);
  const db = await getDb();
  const added = await db
    .insert(schema.referencePictures)
    .values(ids.map((photoId) => ({ pageId: access.page.id, photoId, addedBy: "client" as const })))
    .onConflictDoNothing()
    .returning({ id: schema.referencePictures.id });
  if (added.length) await recordActivity(access.page.id, "added");
  refresh();
  return { added: added.length };
}
