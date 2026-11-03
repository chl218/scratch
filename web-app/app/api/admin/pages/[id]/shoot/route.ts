import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { storeImage, UploadError } from "@/lib/images";
import * as storage from "@/lib/storage";

// Uploads one Shoot Photo to a client page (F6). After a batch, the browser calls
// finishShootUploadAction so the client gets a single email.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/pages/[id]/shoot">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Not authorized" }, { status: 401 });

  const { id: pageId } = await ctx.params;
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) return Response.json({ error: "Not found" }, { status: 404 });
  const [page] = await db
    .select({ id: schema.clientPages.id })
    .from(schema.clientPages)
    .where(eq(schema.clientPages.id, pageId));
  if (!page) return Response.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });

  const shootId = randomUUID();
  const prefix = `shoots/${pageId}/${shootId}`;
  try {
    const stored = await storeImage(file, prefix, { clean: true });
    await db.insert(schema.shootPhotos).values({ id: shootId, pageId, ...stored });
    return Response.json({ id: shootId });
  } catch (err) {
    await storage.remove(prefix);
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
