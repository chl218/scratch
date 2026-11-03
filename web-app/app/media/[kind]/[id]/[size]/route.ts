import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { tryPageAccess } from "@/lib/access";
import { isPublicPhoto } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { cleanOriginalKey } from "@/lib/images";
import * as storage from "@/lib/storage";

const notFound = () => new Response("Not found", { status: 404 });

// Serves photo files with access checks (SPEC F8, F13, F14):
//  - Admins: everything, including library originals.
//  - Anyone: team portraits, and thumbnails/previews of portfolio photos.
//  - Clients (private link or account, via ?a=<key>):
//      library pictures: thumbnail and preview only, never the original
//      Shoot Photos: any size, only their own page, once Your Photos is visible.
//      The "original" they get is the copy with all metadata removed.
export async function GET(req: NextRequest, ctx: RouteContext<"/media/[kind]/[id]/[size]">) {
  const { kind, id, size } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  if (size !== "thumb" && size !== "preview" && size !== "original") return notFound();
  const db = await getDb();

  if (kind === "team") {
    const [profile] = await db.select().from(schema.teamProfiles).where(eq(schema.teamProfiles.userId, id));
    if (!profile?.photoKey) return notFound();
    return serve(profile.photoKey, "image/webp", "public, max-age=86400");
  }
  if (kind !== "photo" && kind !== "shoot") return notFound();

  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const small = size !== "original";
  const isPublic = !isAdmin && small && (await isPublicPhoto(kind, id));
  const access = isAdmin || isPublic ? null : await tryPageAccess(req.nextUrl.searchParams.get("a") ?? "");
  if (!isAdmin && !isPublic && !access) return notFound();
  const asClient = !isAdmin && !isPublic;

  if (kind === "photo") {
    if (asClient && !small) return notFound();
    const [row] = await db.select().from(schema.photos).where(eq(schema.photos.id, id));
    if (!row) return notFound();
    const key = size === "original" ? row.originalKey : size === "preview" ? row.previewKey : row.thumbKey;
    return serve(key, size === "original" ? row.mime : "image/webp");
  }

  const [shoot] = await db.select().from(schema.shootPhotos).where(eq(schema.shootPhotos.id, id));
  if (!shoot) return notFound();
  if (asClient) {
    if (shoot.pageId !== access!.page.id) return notFound();
    if (access!.actor.type === "client" && !access!.page.shootPhotosVisible) return notFound();
  }
  let key = size === "preview" ? shoot.previewKey : shoot.thumbKey;
  if (size === "original") {
    if (isAdmin) key = shoot.originalKey;
    else {
      const clean = await cleanOriginalKey(shoot);
      if (clean.created) await db.update(schema.shootPhotos).set({ cleanKey: clean.key }).where(eq(schema.shootPhotos.id, shoot.id));
      key = clean.key;
    }
  }
  const res = await serve(key, size === "original" ? shoot.mime : "image/webp");
  if (size === "original" && req.nextUrl.searchParams.get("download") === "1") {
    res.headers.set("Content-Disposition", contentDisposition(shoot.filename));
  }
  return res;
}

async function serve(key: string, type: string, cache = "private, max-age=86400, immutable"): Promise<Response> {
  let data: Buffer;
  try {
    data = await storage.get(key);
  } catch {
    return notFound();
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      // Files never change under the same key, so browsers can keep them.
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
