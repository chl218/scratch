import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { storeTeamPhoto, UploadError } from "@/lib/images";

// Uploads a team portrait (F14). Admins upload their own; the Super Admin can upload anyone's.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/team/[userId]/photo">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Not authorized" }, { status: 401 });
  const { userId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "Not found" }, { status: 404 });
  if (userId !== user.id && !user.isSuperAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  // A new key per upload, so browsers don't keep showing the old portrait.
  const key = `team/${userId}/${Date.now()}.webp`;
  try {
    await storeTeamPhoto(file, key);
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
  const db = await getDb();
  const [admin] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });
  await db
    .insert(schema.teamProfiles)
    .values({ userId, displayName: admin.name, photoKey: key })
    .onConflictDoUpdate({ target: schema.teamProfiles.userId, set: { photoKey: key } });
  return Response.json({ ok: true });
}
