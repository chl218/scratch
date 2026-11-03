import type { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { ZipArchive } from "archiver";
import { tryPageAccess } from "@/lib/access";
import { getDb, schema } from "@/lib/db";
import { cleanOriginalKey } from "@/lib/images";
import * as storage from "@/lib/storage";

// Downloads every Shoot Photo on a page as one .zip (F8). Clients get the copies
// with metadata removed (F1); admins get the files as uploaded.
// [key] is the page access key ("t:<token>" or "p:<pageId>").
export async function GET(_req: NextRequest, ctx: RouteContext<"/download/[key]">) {
  const { key } = await ctx.params;
  const access = await tryPageAccess(decodeURIComponent(key));
  if (!access) return new Response("Not found", { status: 404 });
  if (access.actor.type === "client" && !access.page.shootPhotosVisible) {
    return new Response("Not found", { status: 404 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.shootPhotos)
    .where(eq(schema.shootPhotos.pageId, access.page.id))
    .orderBy(schema.shootPhotos.createdAt);
  if (rows.length === 0) return new Response("No photos yet", { status: 404 });

  // Photos are already compressed, so store them as-is (fast, same size).
  const zip = new ZipArchive({ store: true });
  const used = new Set<string>();
  const asClient = access.actor.type === "client";
  for (const row of rows) {
    let key = row.originalKey;
    if (asClient) {
      const clean = await cleanOriginalKey(row);
      if (clean.created) await db.update(schema.shootPhotos).set({ cleanKey: clean.key }).where(eq(schema.shootPhotos.id, row.id));
      key = clean.key;
    }
    const { stream } = await storage.getStream(key);
    zip.append(stream, { name: uniqueName(row.filename, used) });
  }
  void zip.finalize();

  const name = `${access.page.title.replace(/[^\w\- ]+/g, "").trim() || "photos"}.zip`;
  return new Response(Readable.toWeb(zip) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function uniqueName(filename: string, used: Set<string>): string {
  const safe = filename.replace(/[\\/:*?"<>|]+/g, "_") || "photo.jpg";
  let name = safe;
  const dot = safe.lastIndexOf(".");
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    name = dot > 0 ? `${safe.slice(0, dot)} (${i})${safe.slice(dot)}` : `${safe} (${i})`;
  }
  used.add(name.toLowerCase());
  return name;
}
