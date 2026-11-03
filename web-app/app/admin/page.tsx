import Link from "next/link";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/booking";
import { formatDate } from "@/lib/shared";
import { formatWhen } from "@/lib/time";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const user = await requireAdmin();
  const db = await getDb();
  const settings = await getSettings();
  const ev = schema.activityEvents;
  const pg = schema.clientPages;
  const [[photos], [clients], recent, upcoming, [pending]] = await Promise.all([
    db.select({ n: count() }).from(schema.photos),
    db.select({ n: count() }).from(schema.clients),
    db
      .select({
        page: pg,
        clientName: schema.clients.name,
        unseen: sql<number>`(select count(*)::int from ${ev} where ${ev.pageId} = ${pg.id}
                              and (${pg.adminSeenAt} is null or ${ev.createdAt} > ${pg.adminSeenAt}))`,
      })
      .from(pg)
      .innerJoin(schema.clients, eq(schema.clients.id, pg.clientId))
      .orderBy(desc(pg.createdAt))
      .limit(10),
    db
      .select({ b: schema.bookings, clientName: schema.clients.name, adminName: schema.users.name })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.bookings.clientId))
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.adminId))
      .where(and(eq(schema.bookings.status, "confirmed"), gte(schema.bookings.startsAt, new Date())))
      .orderBy(asc(schema.bookings.startsAt))
      .limit(6),
    db.select({ n: count() }).from(schema.adminInvites).where(eq(schema.adminInvites.status, "pending")),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="display text-[36px]">Overview</h1>
        <p className="text-sm text-loupe">
          {photos.n} reference pictures in the <Link href="/admin/library" className="underline">library</Link>,{" "}
          {clients.n} <Link href="/admin/clients" className="underline">clients</Link>.
        </p>
      </div>

      {user.isSuperAdmin && pending.n > 0 && (
        <p className="error-note">
          {pending.n} admin invite{pending.n === 1 ? " is" : "s are"} waiting for your approval.{" "}
          <Link href="/admin/team" className="font-semibold underline">Review</Link>
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-loupe">No bookings coming up.</p>
        ) : (
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {upcoming.map(({ b, clientName, adminName }) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-semibold">{formatWhen(b.startsAt, settings.timeZone)}</span> {b.sessionName} with {clientName}
                </span>
                <span className="text-loupe">{adminName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent client pages</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-loupe">
            No client pages yet. <Link href="/admin/clients" className="underline">Add a client</Link> to create one.
          </p>
        ) : (
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {recent.map(({ page, clientName, unseen }) => (
              <li key={page.id}>
                <Link href={`/admin/pages/${page.id}`} className="flex flex-wrap justify-between gap-2 px-3 py-2 hover:bg-table">
                  <span>
                    <span className="font-semibold">{page.title}</span> <span className="text-loupe">for {clientName}</span>
                    {unseen > 0 && (
                      <span className="ml-2 rounded-full bg-marker px-1.5 text-xs font-semibold text-white">{unseen} new</span>
                    )}
                  </span>
                  <span className="text-loupe">
                    {page.shootDate ? formatDate(page.shootDate) : "No date"}
                    {page.shootPhotosVisible ? ", locked" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
