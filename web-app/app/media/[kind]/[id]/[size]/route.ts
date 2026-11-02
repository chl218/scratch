import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { tryPageAccess } from "@/lib/access";
import { getDb, schema } from "@/lib/db";
import * as storage from "@/lib/storage";

const notFound = () => new Response("Not found", { status: 404 });

// Serves photo files with access checks (SPEC F8):
//  - Admin: everything.
//  - Client (private link or account, via ?a=<key>):
//      library photos: thumbnail and preview only, never the original
//      shoot photos: any size, only for their own page, once the section is visible
export async function GET(req: NextRequest, ctx: RouteContext<"/media/[kind]/[id]/[size]">) {
  const { kind, id, size } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  if (size !== "thumb" && size !== "preview" && size !== "original") return notFound();
  if (kind !== "photo" && kind !== "shoot") return notFound();

  const db = await getDb();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const access = isAdmin ? null : await tryPageAccess(req.nextUrl.searchParams.get("a") ?? "");
  if (!isAdmin && !access) return notFound();

  let row: { originalKey: string; previewKey: string; thumbKey: string; mime: string; filename: string } | undefined;

  if (kind === "photo") {
    if (!isAdmin && size === "original") return notFound();
    [row] = await db.select().from(schema.photos).where(eq(schema.photos.id, id));
  } else {
    const [shoot] = await db.select().from(schema.shootPhotos).where(eq(schema.shootPhotos.id, id));
    if (!shoot) return notFound();
    if (!isAdmin) {
      if (shoot.pageId !== access!.page.id) return notFound();
      if (access!.actor.type === "client" && !access!.page.shootPhotosVisible) return notFound();
    }
    row = shoot;
  }
  if (!row) return notFound();

  const key = size === "original" ? row.originalKey : size === "preview" ? row.previewKey : row.thumbKey;
  let data: Buffer;
  try {
    data = await storage.get(key);
  } catch {
    return notFound();
  }

  const headers = new Headers({
    "Content-Type": size === "original" ? row.mime : "image/webp",
    "Content-Length": String(data.length),
    // Files never change under the same id, so browsers can keep them.
    "Cache-Control": "private, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (kind === "shoot" && size === "original" && req.nextUrl.searchParams.get("download") === "1") {
    headers.set("Content-Disposition", contentDisposition(row.filename));
  }
  return new Response(new Uint8Array(data), { headers });
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
