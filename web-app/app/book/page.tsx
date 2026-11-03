import { connection } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getSettings } from "@/lib/booking";
import { todayIn, zoneLabel } from "@/lib/time";
import { BookingFlow } from "@/components/BookingFlow";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Book a shoot" };

// Book (F15): anyone can browse who's free; logged-in clients can book, or move a booking
// with ?reschedule=<bookingId>.
export default async function BookPage(props: PageProps<"/book">) {
  await connection();
  const sp = await props.searchParams;
  const db = await getDb();
  const [settings, types, found] = await Promise.all([
    getSettings(),
    db.select().from(schema.sessionTypes).where(eq(schema.sessionTypes.active, true)).orderBy(asc(schema.sessionTypes.sortOrder)),
    getCurrentClient(),
  ]);

  let reschedule: { bookingId: string; sessionTypeId: string; label: string } | undefined;
  const moving = typeof sp.reschedule === "string" ? sp.reschedule : "";
  if (found && /^[0-9a-f-]{36}$/i.test(moving)) {
    const [b] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.id, moving), eq(schema.bookings.clientId, found.client.id), eq(schema.bookings.status, "confirmed")));
    if (b?.sessionTypeId) reschedule = { bookingId: b.id, sessionTypeId: b.sessionTypeId, label: b.sessionName };
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader current="/book" />
      <main className="w-full max-w-[1200px] px-4 pb-8 sm:px-8 lg:px-11">
        <h1 className="display text-[32px] sm:text-[44px]">{reschedule ? "Move your booking" : "Book a shoot"}</h1>
        <p className="mt-3 max-w-[60ch] text-loupe">
          {found
            ? "Pick a session and a time. Bookings are confirmed straight away, and you'll get an email."
            : "See who's free and when. Clients with an account can book straight away."}
        </p>
        <div className="mt-8">
          <BookingFlow
            types={types.map((t) => ({ id: t.id, name: t.name, durationMinutes: t.durationMinutes, description: t.description }))}
            today={todayIn(settings.timeZone)}
            zone={zoneLabel(settings.timeZone)}
            canBook={Boolean(found)}
            reschedule={reschedule}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
