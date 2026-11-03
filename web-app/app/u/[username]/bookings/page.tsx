import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { resolveArea } from "@/lib/area";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/booking";
import { formatWhen, zoneLabel } from "@/lib/time";
import { cancelBookingAction } from "@/app/actions/client";
import { ActionButton } from "@/components/ActionButton";

export const metadata = { title: "Bookings" };

// The client's bookings (F15): move or cancel up to the cutoff.
export default async function ClientBookings(props: PageProps<"/u/[username]/bookings">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const area = await resolveArea(username);
  if (!area?.loggedIn) notFound();
  const db = await getDb();
  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({ b: schema.bookings, admin: schema.users.name, display: schema.teamProfiles.displayName })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.adminId))
      .leftJoin(schema.teamProfiles, eq(schema.teamProfiles.userId, schema.users.id))
      .where(eq(schema.bookings.clientId, area.client.id))
      .orderBy(desc(schema.bookings.startsAt)),
  ]);
  const cutoff = settings.cancelCutoffHours * 3600 * 1000;
  const now = new Date().getTime();

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[24px] font-semibold">Bookings</h2>
        <Link href="/book" className="btn-primary">Book a shoot</Link>
      </div>
      {sp.booked && <p className="ok-note" role="status">Booked. A confirmation is on its way to your email.</p>}
      {sp.moved && <p className="ok-note" role="status">Moved. The new time is in your email.</p>}
      <p className="text-sm text-loupe">
        Times in {zoneLabel(settings.timeZone)}. You can move or cancel a booking up to {settings.cancelCutoffHours} hours
        before it starts. After that, message the studio.
      </p>
      {rows.length === 0 ? (
        <p className="text-loupe">No bookings yet.</p>
      ) : (
        <ul className="divide-y divide-sleeve border-y border-sleeve">
          {rows.map(({ b, admin, display }) => {
            const changeable = b.status === "confirmed" && b.startsAt.getTime() - now > cutoff;
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className={`font-semibold ${b.status === "cancelled" ? "text-loupe line-through" : ""}`}>
                    {b.sessionName}, {formatWhen(b.startsAt, settings.timeZone)}
                  </p>
                  <p className="text-sm text-loupe">
                    With {display || admin}
                    {b.status === "cancelled" ? ". Cancelled" : b.startsAt.getTime() < now ? ". Done" : ""}
                  </p>
                </div>
                {changeable && (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/book?reschedule=${b.id}`} className="btn-secondary">Move</Link>
                    <ActionButton action={cancelBookingAction.bind(null, b.id)} className="btn-danger" confirm="Cancel this booking?">
                      Cancel booking
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
