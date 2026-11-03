import Link from "next/link";
import { eq } from "drizzle-orm";
import { isLocked, type PageAccess } from "@/lib/access";
import { getDb, schema } from "@/lib/db";
import { pageReferences, pageShootPhotos } from "@/lib/data";
import { formatDate } from "@/lib/shared";
import { Board, YourPhotos } from "./ClientBoard";
import type { CommentPermission } from "./Comments";

/** Names of the client's assigned admins, shown as their contacts (F12). */
async function contactNames(clientId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ name: schema.users.name, display: schema.teamProfiles.displayName })
    .from(schema.clientAdmins)
    .innerJoin(schema.users, eq(schema.users.id, schema.clientAdmins.adminId))
    .leftJoin(schema.teamProfiles, eq(schema.teamProfiles.userId, schema.users.id))
    .where(eq(schema.clientAdmins.clientId, clientId));
  return rows.map((r) => r.display || r.name);
}

/**
 * A client page (F3, F6). Before the lock: the Board of Reference Pictures.
 * After the lock: only Your Photos, plus a Home button.
 */
export async function ClientPageView({ access, path }: { access: PageAccess; path: string }) {
  const { page, client } = access;
  const locked = isLocked(page);
  const [references, shootPhotos, contacts] = await Promise.all([
    locked ? Promise.resolve([]) : pageReferences(page.id),
    locked ? pageShootPhotos(page.id) : Promise.resolve([]),
    contactNames(client.id),
  ]);
  const permission: CommentPermission = access.actor.userId
    ? { canComment: true }
    : { canComment: false, loginHref: `/login?next=${encodeURIComponent(path)}`, hasAccount: Boolean(client.userId) };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="display text-[48px] sm:text-[72px]">{page.title}</h1>
        <p className="text-loupe">
          For {client.name}
          {page.shootDate && <>, shoot on {formatDate(page.shootDate)}</>}
          {contacts.length > 0 && <>. With {contacts.join(" and ")} from the studio</>}.
        </p>
        {page.notes && !locked && <p className="max-w-[65ch] whitespace-pre-wrap pt-1">{page.notes}</p>}
      </header>

      {locked ? (
        <YourPhotos accessKey={access.key} photos={shootPhotos} favouritesLimit={page.favouritesLimit} permission={permission} />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="max-w-[65ch] text-loupe">
              Accept the pictures whose look you like and reject the rest. Choices save as you go, and you can change them
              until your photos are ready.
            </p>
            {client.username && (
              <Link href={`/u/${client.username}?page=${page.id}`} className="btn-secondary">
                Find more references
              </Link>
            )}
          </div>
          <Board accessKey={access.key} references={references} permission={permission} />
        </>
      )}
    </div>
  );
}
