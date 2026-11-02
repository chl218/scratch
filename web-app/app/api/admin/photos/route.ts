import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { storeImage, UploadError } from "@/lib/images";
import { setPhotoTags } from "@/lib/data";
import { parseTags } from "@/lib/shared";
import * as storage from "@/lib/storage";

// Uploads one library photo (F1). The browser sends files one at a time so
// each request stays under the 50 MB limit. Route handlers have no 1 MB body
// cap (that applies to server actions only).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Not authorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);
  const tags = parseTags(String(form.get("tags") ?? ""));

  const photoId = randomUUID();
  try {
    const stored = await storeImage(file, `library/${photoId}`);
    const db = await getDb();
    await db.insert(schema.photos).values({ id: photoId, title, notes, ...stored });
    await setPhotoTags(photoId, tags);
    return Response.json({ id: photoId });
  } catch (err) {
    await storage.remove(`library/${photoId}`);
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
