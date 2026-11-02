"use server";

// Actions on a client page. Each takes the page's access key ("t:<token>" for the
// private link, "p:<pageId>" for a logged-in client or the admin) and checks it.

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { resolvePageAccess, type PageAccess } from "@/lib/access";
import { allTags, commentsFor, searchPhotos, type CommentView, type LibraryPhoto } from "@/lib/data";
import { parseTags } from "@/lib/shared";

const id = z.string().uuid();
const target = z.union([
  z.object({ inspirationId: id }),
  z.object({ shootPhotoId: id }),
]);
export type CommentTarget = z.infer<typeof target>;

/** Checks the comment target belongs to this page (and is visible to a client). */
async function checkTarget(access: PageAccess, t: CommentTarget) {
  const db = await getDb();
  if ("inspirationId" in t) {
    const [row] = await db
      .select({ id: schema.inspirations.id })
      .from(schema.inspirations)
      .where(and(eq(schema.inspirations.id, t.inspirationId), eq(schema.inspirations.pageId, access.page.id)));
    if (!row) throw new Error("Not found");
  } else {
    if (access.actor.type === "client" && !access.page.shootPhotosVisible) throw new Error("Not found");
    const [row] = await db
      .select({ id: schema.shootPhotos.id })
      .from(schema.shootPhotos)
      .where(and(eq(schema.shootPhotos.id, t.shootPhotoId), eq(schema.shootPhotos.pageId, access.page.id)));
    if (!row) throw new Error("Not found");
  }
}

export async function setInspirationStateAction(
  key: string,
  inspirationId: string,
  state: "undecided" | "accepted" | "rejected",
) {
  const access = await resolvePageAccess(key);
  if (access.actor.type !== "client") throw new Error("Only the client chooses inspirations");
  id.parse(inspirationId);
  z.enum(["undecided", "accepted", "rejected"]).parse(state);
  const db = await getDb();
  await db
    .update(schema.inspirations)
    .set({ state })
    .where(and(eq(schema.inspirations.id, inspirationId), eq(schema.inspirations.pageId, access.page.id)));
}

/** F4: the client searches the whole library by tag. */
export async function searchLibraryAction(
  key: string,
  tagInput: string,
): Promise<{ photos: LibraryPhoto[]; tags: { name: string; count: number }[] }> {
  await resolvePageAccess(key);
  const tags = parseTags(z.string().max(500).parse(tagInput));
  const [photos, tagList] = await Promise.all([searchPhotos(tags, 200), allTags()]);
  // Clients only need what the grid shows.
  return {
    photos: photos.map((p) => ({ ...p, notes: "" })),
    tags: tagList,
  };
}

/** F4: the client adds library photos to their inspirations. No email is sent for these. */
export async function clientAddInspirationsAction(key: string, photoIds: string[]) {
  const access = await resolvePageAccess(key);
  if (access.actor.type !== "client") throw new Error("Not allowed");
  const ids = z.array(id).min(1).max(200).parse(photoIds);
  const db = await getDb();
  await db
    .insert(schema.inspirations)
    .values(ids.map((photoId) => ({ pageId: access.page.id, photoId, addedBy: "client" as const })))
    .onConflictDoNothing();
  refresh();
}

export async function getCommentsAction(key: string, t: CommentTarget): Promise<CommentView[]> {
  const access = await resolvePageAccess(key);
  const parsed = target.parse(t);
  await checkTarget(access, parsed);
  return commentsFor(access.page.id, parsed);
}

export async function addCommentAction(key: string, t: CommentTarget, body: string): Promise<CommentView[]> {
  const access = await resolvePageAccess(key);
  const parsed = target.parse(t);
  const text = z.string().trim().min(1).max(2000).parse(body);
  await checkTarget(access, parsed);
  const db = await getDb();
  await db.insert(schema.comments).values({
    pageId: access.page.id,
    inspirationId: "inspirationId" in parsed ? parsed.inspirationId : null,
    shootPhotoId: "shootPhotoId" in parsed ? parsed.shootPhotoId : null,
    authorType: access.actor.type,
    authorName: access.actor.name,
    body: text,
  });
  return commentsFor(access.page.id, parsed);
}
