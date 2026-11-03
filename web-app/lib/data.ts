import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

const { photos, tags, photoTags, shootPhotoTags, referencePictures, shootPhotos, comments, clientPages } = schema;

export type LibraryPhoto = {
  id: string;
  title: string;
  notes: string;
  width: number;
  height: number;
  tags: string[];
  credit: string;
  sourceUrl: string;
  inPortfolio: boolean;
  focusX: number;
  focusY: number;
};

const libraryColumns = {
  id: photos.id,
  title: photos.title,
  notes: photos.notes,
  width: photos.width,
  height: photos.height,
  credit: photos.credit,
  sourceUrl: photos.sourceUrl,
  inPortfolio: photos.inPortfolio,
  focusX: photos.focusX,
  focusY: photos.focusY,
};

/** Library tags with how many pictures use each. */
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

async function shootTagsFor(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select({ id: shootPhotoTags.shootPhotoId, name: tags.name })
    .from(shootPhotoTags)
    .innerJoin(tags, eq(tags.id, shootPhotoTags.tagId))
    .where(inArray(shootPhotoTags.shootPhotoId, ids))
    .orderBy(tags.name);
  for (const r of rows) map.set(r.id, [...(map.get(r.id) ?? []), r.name]);
  return map;
}

/** Library pictures with ALL of the given tags (or every picture when no tags are given). */
export async function searchPhotos(tagNames: string[], limit = 500): Promise<LibraryPhoto[]> {
  const db = await getDb();
  const base = db.select(libraryColumns).from(photos);
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
    rows = await base.where(inArray(photos.id, matching)).orderBy(desc(photos.createdAt)).limit(limit);
  }
  const tagMap = await tagsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

async function removeUnusedTags() {
  const db = await getDb();
  await db.execute(
    sql`delete from ${tags} where not exists (select 1 from ${photoTags} where ${photoTags.tagId} = ${tags.id})
        and not exists (select 1 from ${shootPhotoTags} where ${shootPhotoTags.tagId} = ${tags.id})`,
  );
}

async function tagIds(names: string[]): Promise<number[]> {
  const db = await getDb();
  await db.insert(tags).values(names.map((name) => ({ name }))).onConflictDoNothing();
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
  return rows.map((r) => r.id);
}

/** Replaces a library picture's tags, creating any tags that don't exist yet. */
export async function setPhotoTags(photoId: string, names: string[]): Promise<void> {
  const db = await getDb();
  await db.delete(photoTags).where(eq(photoTags.photoId, photoId));
  if (names.length > 0) {
    const ids = await tagIds(names);
    await db.insert(photoTags).values(ids.map((tagId) => ({ photoId, tagId })));
  }
  await removeUnusedTags();
}

/** Replaces a Shoot Photo's tags (used by portfolio search, F13). */
export async function setShootPhotoTags(shootPhotoId: string, names: string[]): Promise<void> {
  const db = await getDb();
  await db.delete(shootPhotoTags).where(eq(shootPhotoTags.shootPhotoId, shootPhotoId));
  if (names.length > 0) {
    const ids = await tagIds(names);
    await db.insert(shootPhotoTags).values(ids.map((tagId) => ({ shootPhotoId, tagId })));
  }
  await removeUnusedTags();
}

// ---------- Client page: the Board (F3) ----------

export type BoardReference = {
  referenceId: string;
  /** Null when the picture was deleted from the library (name-only record). */
  photoId: string | null;
  state: "undecided" | "accepted" | "rejected";
  addedBy: "admin" | "client";
  hidden: boolean;
  title: string;
  credit: string;
  sourceUrl: string;
  width: number;
  height: number;
  tags: string[];
  commentCount: number;
};

/** The Board of a page. Pictures an admin hid are left out unless `includeHidden`. */
export async function pageReferences(pageId: string, opts: { includeHidden?: boolean } = {}): Promise<BoardReference[]> {
  const db = await getDb();
  const rows = await db
    .select({
      referenceId: referencePictures.id,
      photoId: photos.id,
      state: referencePictures.state,
      addedBy: referencePictures.addedBy,
      hiddenAt: referencePictures.hiddenAt,
      title: photos.title,
      credit: photos.credit,
      sourceUrl: photos.sourceUrl,
      width: photos.width,
      height: photos.height,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.referencePictureId} = ${referencePictures.id})`,
    })
    .from(referencePictures)
    .innerJoin(photos, eq(photos.id, referencePictures.photoId))
    .where(and(eq(referencePictures.pageId, pageId), opts.includeHidden ? undefined : isNull(referencePictures.hiddenAt)))
    .orderBy(referencePictures.createdAt, referencePictures.id);
  const tagMap = await tagsFor(rows.map((r) => r.photoId));
  return rows.map(({ hiddenAt, ...r }) => ({ ...r, hidden: hiddenAt !== null, tags: tagMap.get(r.photoId) ?? [] }));
}

export type BoardShootPhoto = {
  id: string;
  filename: string;
  width: number;
  height: number;
  favourite: boolean;
  inPortfolio: boolean;
  focusX: number;
  focusY: number;
  tags: string[];
  commentCount: number;
};

export async function pageShootPhotos(pageId: string): Promise<BoardShootPhoto[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: shootPhotos.id,
      filename: shootPhotos.filename,
      width: shootPhotos.width,
      height: shootPhotos.height,
      favourite: shootPhotos.favourite,
      inPortfolio: shootPhotos.inPortfolio,
      focusX: shootPhotos.focusX,
      focusY: shootPhotos.focusY,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.shootPhotoId} = ${shootPhotos.id})`,
    })
    .from(shootPhotos)
    .where(eq(shootPhotos.pageId, pageId))
    .orderBy(shootPhotos.createdAt, shootPhotos.id);
  const tagMap = await shootTagsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

// ---------- Comments (F5) ----------

export type CommentView = {
  id: string;
  authorType: "admin" | "client";
  authorName: string;
  body: string;
  createdAt: string;
};

export type CommentTargetIds = { referencePictureId: string } | { shootPhotoId: string };

export async function commentsFor(pageId: string, target: CommentTargetIds): Promise<CommentView[]> {
  const db = await getDb();
  const cond =
    "referencePictureId" in target
      ? eq(comments.referencePictureId, target.referencePictureId)
      : eq(comments.shootPhotoId, target.shootPhotoId);
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

// ---------- Saved references after the lock (F4, F6) ----------

export type SavedReference = {
  referenceId: string;
  photoId: string | null;
  title: string;
  filename: string;
  tags: string[];
  acceptedAt: string | null;
  pageTitle: string;
  width: number;
  height: number;
};

/** Accepted pictures snapshotted on a client's locked pages, matching all `tagNames`. */
export async function savedReferences(clientId: string, tagNames: string[] = []): Promise<SavedReference[]> {
  const db = await getDb();
  const rows = await db
    .select({
      referenceId: referencePictures.id,
      photoId: referencePictures.photoId,
      title: referencePictures.snapshotTitle,
      filename: referencePictures.snapshotFilename,
      tags: referencePictures.snapshotTags,
      acceptedAt: referencePictures.acceptedAt,
      pageTitle: clientPages.title,
      width: photos.width,
      height: photos.height,
    })
    .from(referencePictures)
    .innerJoin(clientPages, eq(clientPages.id, referencePictures.pageId))
    .leftJoin(photos, eq(photos.id, referencePictures.photoId))
    .where(
      and(
        eq(clientPages.clientId, clientId),
        eq(clientPages.shootPhotosVisible, true),
        eq(referencePictures.state, "accepted"),
        isNotNull(referencePictures.snapshotFilename),
      ),
    )
    .orderBy(desc(referencePictures.acceptedAt));
  return rows
    .map((r) => ({
      ...r,
      title: r.title ?? "",
      filename: r.filename ?? "",
      tags: r.tags ?? [],
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
      width: r.width ?? 4,
      height: r.height ?? 5,
    }))
    .filter((r) => tagNames.every((t) => r.tags.includes(t)));
}

// ---------- Public portfolio (F13) ----------

export type PortfolioPhoto = {
  kind: "photo" | "shoot";
  id: string;
  title: string;
  width: number;
  height: number;
  focusX: number;
  focusY: number;
  createdAt: string;
};

/** Every portfolio photo, newest first, optionally only those with ALL `tagNames`. */
export async function portfolioPhotos(tagNames: string[] = []): Promise<PortfolioPhoto[]> {
  const db = await getDb();
  const n = tagNames.length;
  const tagList = sql.join(tagNames.map((t) => sql`${t}`), sql`, `);
  const libraryMatch = n
    ? sql`and ${photos.id} in (select pt.photo_id from photo_tags pt join tags t on t.id = pt.tag_id
          where t.name in (${tagList}) group by pt.photo_id having count(distinct t.name) = ${n})`
    : sql``;
  const shootMatch = n
    ? sql`and ${shootPhotos.id} in (select st.shoot_photo_id from shoot_photo_tags st join tags t on t.id = st.tag_id
          where t.name in (${tagList}) group by st.shoot_photo_id having count(distinct t.name) = ${n})`
    : sql``;
  const result = await db.execute<{
    kind: "photo" | "shoot";
    id: string;
    title: string;
    width: number;
    height: number;
    focus_x: number;
    focus_y: number;
    created_at: string | Date;
  }>(sql`
    select 'photo' as kind, ${photos.id} as id, ${photos.title} as title, ${photos.width} as width, ${photos.height} as height,
           ${photos.focusX} as focus_x, ${photos.focusY} as focus_y, ${photos.createdAt} as created_at
      from ${photos} where ${photos.inPortfolio} and ${photos.credit} = '' ${libraryMatch}
    union all
    select 'shoot', ${shootPhotos.id}, '', ${shootPhotos.width}, ${shootPhotos.height},
           ${shootPhotos.focusX}, ${shootPhotos.focusY}, ${shootPhotos.createdAt}
      from ${shootPhotos} where ${shootPhotos.inPortfolio} ${shootMatch}
    order by created_at desc`);
  return result.rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    title: r.title,
    width: Number(r.width),
    height: Number(r.height),
    focusX: Number(r.focus_x),
    focusY: Number(r.focus_y),
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/**
 * Tags used on portfolio photos only, most used first, so private library tags
 * never reach the public.
 */
export async function portfolioTags(): Promise<{ name: string; count: number }[]> {
  const db = await getDb();
  const result = await db.execute<{ name: string; count: number }>(sql`
    select name, sum(uses)::int as count from (
      select t.name, count(*) as uses from tags t
        join photo_tags pt on pt.tag_id = t.id
        join photos p on p.id = pt.photo_id and p.in_portfolio and p.credit = ''
        group by t.name
      union all
      select t.name, count(*) from tags t
        join shoot_photo_tags st on st.tag_id = t.id
        join shoot_photos s on s.id = st.shoot_photo_id and s.in_portfolio
        group by t.name
    ) used
    group by name
    order by sum(uses) desc, name`);
  return result.rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

/** Whether a photo may be shown publicly (media route). */
export async function isPublicPhoto(kind: "photo" | "shoot", id: string): Promise<boolean> {
  const db = await getDb();
  if (kind === "photo") {
    const [row] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.inPortfolio, true), eq(photos.credit, "")));
    return Boolean(row);
  }
  const [row] = await db
    .select({ id: shootPhotos.id })
    .from(shootPhotos)
    .where(and(eq(shootPhotos.id, id), eq(shootPhotos.inPortfolio, true)));
  return Boolean(row);
}
