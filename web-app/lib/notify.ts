import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { EmailPrefs } from "./db/schema";
import { sendMail } from "./mail";
import { appUrl } from "./tokens";

export const PRODUCT = "ReferenceMePlzQQ";

async function deliver(clientId: string | null, to: string, type: string, subject: string, text: string) {
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

export async function notifyClient(clientId: string, type: string, subject: string, body: string) {
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) return;
  await deliver(client.id, client.email, type, subject, `Hi ${client.name},\n\n${body}\n\n— ${PRODUCT}\n`);
}

type Recipient = { id: string; email: string; emailPrefs: EmailPrefs };

/**
 * Admins who should hear about a client: their assigned admins plus the Super
 * Admin (F7), minus anyone who turned that kind of email off.
 */
export async function adminsFor(clientId: string, pref: keyof EmailPrefs): Promise<Recipient[]> {
  const db = await getDb();
  const assigned = db
    .select({ id: schema.clientAdmins.adminId })
    .from(schema.clientAdmins)
    .where(eq(schema.clientAdmins.clientId, clientId));
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, emailPrefs: schema.users.emailPrefs })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.role, "admin"),
        eq(schema.users.disabled, false),
        or(eq(schema.users.isSuperAdmin, true), inArray(schema.users.id, assigned)),
      ),
    );
  return rows.filter((r) => r.emailPrefs?.[pref] !== false);
}

export async function notifyClientAdmins(
  clientId: string,
  pref: keyof EmailPrefs,
  type: string,
  subject: string,
  body: string,
) {
  for (const admin of await adminsFor(clientId, pref)) await deliver(null, admin.email, type, subject, body);
}

/** Every active admin who wants this kind of email (contact form, F16). */
export async function notifyAllAdmins(pref: keyof EmailPrefs, type: string, subject: string, body: string) {
  const db = await getDb();
  const rows = await db
    .select({ email: schema.users.email, emailPrefs: schema.users.emailPrefs })
    .from(schema.users)
    .where(and(eq(schema.users.role, "admin"), eq(schema.users.disabled, false)));
  for (const r of rows) if (r.emailPrefs?.[pref] !== false) await deliver(null, r.email, type, subject, body);
}

export async function notifySuperAdmin(type: string, subject: string, body: string) {
  const db = await getDb();
  const [row] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.isSuperAdmin, true));
  if (row) await deliver(null, row.email, type, subject, body);
}

/** Link for the client to open a page: their private link, or their client area if it was revoked. */
export async function pageLinkFor(page: { id: string; linkToken: string | null; clientId: string }): Promise<string> {
  if (page.linkToken) return appUrl(`/c/${page.linkToken}`);
  const db = await getDb();
  const [client] = await db
    .select({ username: schema.clients.username })
    .from(schema.clients)
    .where(eq(schema.clients.id, page.clientId));
  return appUrl(`/u/${client?.username ?? ""}`);
}

/** Emails the client about Shoot Photos they haven't been told about yet (F7). */
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
      `You can view, favourite and download them here:\n${await pageLinkFor(page)}`,
  );
}
