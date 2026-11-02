import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { sendMail } from "./mail";
import { appUrl } from "./tokens";

type NotificationType = (typeof schema.notifications.$inferInsert)["type"];

async function deliver(
  clientId: string | null,
  to: string,
  type: NotificationType,
  subject: string,
  text: string,
) {
  const db = await getDb();
  try {
    await sendMail({ to, subject, text });
    await db.insert(schema.notifications).values({ clientId, recipient: to, type, subject, status: "sent" });
  } catch (err) {
    // A failed email shouldn't undo the change that triggered it; record it instead.
    console.error("[mail] failed", err);
    await db.insert(schema.notifications).values({
      clientId,
      recipient: to,
      type,
      subject,
      status: "failed",
      error: String(err),
    });
  }
}

export async function notifyClient(
  clientId: string,
  type: NotificationType,
  subject: string,
  body: string,
) {
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) return;
  await deliver(client.id, client.email, type, subject, `Hi ${client.name},\n\n${body}\n`);
}

export async function notifyAdmins(type: NotificationType, subject: string, body: string) {
  const db = await getDb();
  const admins = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));
  for (const admin of admins) await deliver(null, admin.email, type, subject, body);
}

/** Link for the client to open a page: their private link, or their account if it was revoked. */
export function pageLinkFor(page: { id: string; linkToken: string | null }): string {
  return page.linkToken ? appUrl(`/c/${page.linkToken}`) : appUrl(`/account/pages/${page.id}`);
}

/** Emails the client about shoot photos they haven't been told about yet (F7). */
export async function notifyNewShootPhotos(pageId: string) {
  const db = await getDb();
  const [page] = await db.select().from(schema.clientPages).where(eq(schema.clientPages.id, pageId));
  if (!page || !page.shootPhotosVisible) return;
  const newlyNotified = await db
    .update(schema.shootPhotos)
    .set({ notified: true })
    .where(and(eq(schema.shootPhotos.pageId, pageId), eq(schema.shootPhotos.notified, false)))
    .returning({ id: schema.shootPhotos.id });
  const count = newlyNotified.length;
  if (count === 0) return;
  await notifyClient(
    page.clientId,
    "shoot_photos",
    `Your photos from "${page.title}" are ready`,
    `${count} new photo${count === 1 ? " has" : "s have"} been added to "${page.title}". ` +
      `You can view and download them here:\n${pageLinkFor(page)}`,
  );
}
