import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

const { photos, tags, photoTags, inspirations, shootPhotos, comments } = schema;

export type LibraryPhoto = {
  id: string;
  title: string;
  notes: string;
  width: number;
  height: number;
  tags: string[];
};

export async function allTags(): Promise<{ name: string; count: number }[]> {
  const db = await getDb();
  return db
    .select({ name: tags.name, count: count(photoTags.photoId) })
    .from(tags)
    .innerJoin(photoTags, eq(photoTags.tagId, tags.id))
    .groupBy(tags.name)
    .orderBy(desc(count(photoTags.photoId)), tags.name);
}

async function tagsFor(photoIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (photoIds.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select({ photoId: photoTags.photoId, name: tags.name })
    .from(photoTags)
    .innerJoin(tags, eq(tags.id, photoTags.tagId))
    .where(inArray(photoTags.photoId, photoIds))
    .orderBy(tags.name);
  for (const r of rows) map.set(r.photoId, [...(map.get(r.photoId) ?? []), r.name]);
  return map;
}

/** Library photos that have ALL of the given tags (or every photo when no tags are given). */
export async function searchPhotos(tagNames: string[], limit = 500): Promise<LibraryPhoto[]> {
  const db = await getDb();
  const base = db
    .select({
      id: photos.id,
      title: photos.title,
      notes: photos.notes,
      width: photos.width,
      height: photos.height,
    })
    .from(photos);

  let rows;
  if (tagNames.length === 0) {
    rows = await base.orderBy(desc(photos.createdAt)).limit(limit);
  } else {
    const matching = db
      .select({ photoId: photoTags.photoId })
      .from(photoTags)
      .innerJoin(tags, eq(tags.id, photoTags.tagId))
      .where(inArray(tags.name, tagNames))
      .groupBy(photoTags.photoId)
      .having(sql`count(distinct ${tags.name}) = ${tagNames.length}`);
    rows = await base
      .where(inArray(photos.id, matching))
      .orderBy(desc(photos.createdAt))
      .limit(limit);
  }
  const tagMap = await tagsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

/** Replaces a photo's tags, creating any tags that don't exist yet. */
export async function setPhotoTags(photoId: string, names: string[]): Promise<void> {
  const db = await getDb();
  await db.delete(photoTags).where(eq(photoTags.photoId, photoId));
  if (names.length === 0) return;
  await db.insert(tags).values(names.map((name) => ({ name }))).onConflictDoNothing();
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
  await db.insert(photoTags).values(rows.map((t) => ({ photoId, tagId: t.id })));
  // Remove tags no photo uses any more, so the tag list stays tidy.
  await db.execute(
    sql`delete from ${tags} where not exists (select 1 from ${photoTags} where ${photoTags.tagId} = ${tags.id})`,
  );
}

export type BoardInspiration = LibraryPhoto & {
  inspirationId: string;
  photoId: string;
  state: "undecided" | "accepted" | "rejected";
  addedBy: "admin" | "client";
  commentCount: number;
};

export type BoardShootPhoto = {
  id: string;
  filename: string;
  width: number;
  height: number;
  commentCount: number;
};

export async function pageInspirations(pageId: string): Promise<BoardInspiration[]> {
  const db = await getDb();
  const rows = await db
    .select({
      inspirationId: inspirations.id,
      photoId: photos.id,
      state: inspirations.state,
      addedBy: inspirations.addedBy,
      title: photos.title,
      notes: photos.notes,
      width: photos.width,
      height: photos.height,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.inspirationId} = ${inspirations.id})`,
    })
    .from(inspirations)
    .innerJoin(photos, eq(photos.id, inspirations.photoId))
    .where(eq(inspirations.pageId, pageId))
    .orderBy(inspirations.createdAt);
  const tagMap = await tagsFor(rows.map((r) => r.photoId));
  return rows.map((r) => ({ ...r, id: r.photoId, tags: tagMap.get(r.photoId) ?? [] }));
}

export async function pageShootPhotos(pageId: string): Promise<BoardShootPhoto[]> {
  const db = await getDb();
  return db
    .select({
      id: shootPhotos.id,
      filename: shootPhotos.filename,
      width: shootPhotos.width,
      height: shootPhotos.height,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.shootPhotoId} = ${shootPhotos.id})`,
    })
    .from(shootPhotos)
    .where(eq(shootPhotos.pageId, pageId))
    .orderBy(shootPhotos.createdAt);
}

export type CommentView = {
  id: string;
  authorType: "admin" | "client";
  authorName: string;
  body: string;
  createdAt: string;
};

export async function commentsFor(
  pageId: string,
  target: { inspirationId?: string; shootPhotoId?: string },
): Promise<CommentView[]> {
  const db = await getDb();
  const cond = target.inspirationId
    ? eq(comments.inspirationId, target.inspirationId)
    : target.shootPhotoId
      ? eq(comments.shootPhotoId, target.shootPhotoId)
      : sql`false`;
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.pageId, pageId), cond))
    .orderBy(comments.createdAt);
  return rows.map((c) => ({
    id: c.id,
    authorType: c.authorType,
    authorName: c.authorName,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));
}
