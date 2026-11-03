import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/booking";
import { formatDate } from "@/lib/shared";
import { formatWhen, zonedDate, zoneLabel, formatTime } from "@/lib/time";
import {
  addTimeOffAction,
  adminCancelBookingAction,
  adminRescheduleBookingAction,
  createSessionTypeAction,
  removeTimeOffAction,
  saveHoursAction,
  setSessionTypeActiveAction,
} from "@/app/actions/team";
import { HoursForm, RescheduleForm, SessionTypeForm, TimeOffForm } from "@/components/AdminForms";
import { ActionButton } from "@/components/ActionButton";

export const metadata = { title: "Bookings" };

function hm24(date: Date, timeZone: string) {
  return new Date(date).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

// Bookings (F15): upcoming sessions, session types, and the admin's hours and time off.
export default async function AdminBookings(props: PageProps<"/admin/bookings">) {
  const me = await requireAdmin();
  const sp = await props.searchParams;
  const db = await getDb();
  const settings = await getSettings();
  const admins = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.role, "admin"), eq(schema.users.disabled, false)));
  const whoseId = me.isSuperAdmin && typeof sp.admin === "string" && admins.some((a) => a.id === sp.admin) ? sp.admin : me.id;
  const whose = admins.find((a) => a.id === whoseId)!;

  const [upcoming, types, rules, off] = await Promise.all([
    db
      .select({ b: schema.bookings, clientName: schema.clients.name, adminName: schema.users.name })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.bookings.clientId))
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.adminId))
      .where(and(eq(schema.bookings.status, "confirmed"), gte(schema.bookings.endsAt, new Date())))
      .orderBy(asc(schema.bookings.startsAt)),
    db.select().from(schema.sessionTypes).orderBy(asc(schema.sessionTypes.sortOrder)),
    db.select().from(schema.availabilityRules).where(eq(schema.availabilityRules.adminId, whoseId)),
    db.select().from(schema.timeOff).where(eq(schema.timeOff.adminId, whoseId)).orderBy(asc(schema.timeOff.startDate)),
  ]);

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <h1 className="display text-[36px]">Bookings</h1>
        <p className="text-sm text-loupe">Times in {zoneLabel(settings.timeZone)}.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-loupe">No bookings coming up.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map(({ b, clientName, adminName }) => (
              <li key={b.id} className="panel space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <span className="font-semibold">{formatWhen(b.startsAt, settings.timeZone)}</span> to {formatTime(b.endsAt, settings.timeZone)}.{" "}
                    {b.sessionName} with <Link href={`/admin/clients/${b.clientId}`} className="underline">{clientName}</Link>
                  </p>
                  <span className="text-sm text-loupe">{adminName}</span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">Move or cancel</summary>
                  <div className="space-y-3 pt-3">
                    <RescheduleForm
                      action={adminRescheduleBookingAction.bind(null, b.id)}
                      admins={admins}
                      defaults={{ date: zonedDate(b.startsAt, settings.timeZone), time: hm24(b.startsAt, settings.timeZone), adminId: b.adminId }}
                    />
                    <ActionButton className="btn-danger" action={adminCancelBookingAction.bind(null, b.id)} confirm="Cancel this booking? The client is emailed.">
                      Cancel booking
                    </ActionButton>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Session types</h2>
        {types.length > 0 && (
          <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className={t.active ? "" : "text-loupe"}>
                  <span className="font-semibold">{t.name}</span>, {t.durationMinutes} minutes
                  {t.description && <span className="text-loupe">. {t.description}</span>}
                  {!t.active && ". Hidden from the Book page"}
                </span>
                <ActionButton className="btn-quiet" action={setSessionTypeActiveAction.bind(null, t.id, !t.active)}>
                  {t.active ? "Hide" : "Show"}
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
        <div className="panel">
          <SessionTypeForm action={createSessionTypeAction} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{whose.id === me.id ? "Your working hours" : `${whose.name}'s working hours`}</h2>
          {me.isSuperAdmin && admins.length > 1 && (
            <div className="flex flex-wrap gap-1.5 text-sm">
              {admins.map((a) => (
                <Link key={a.id} href={`/admin/bookings?admin=${a.id}`} className={`pill text-xs ${a.id === whoseId ? "pill-on" : ""}`}>
                  {a.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <HoursForm key={whoseId} action={saveHoursAction.bind(null, whoseId)} rules={rules} />
        </div>
        <h3 className="font-semibold">Time off</h3>
        {off.length > 0 && (
          <ul className="space-y-1 text-sm">
            {off.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3">
                <span>
                  {formatDate(o.startDate)}
                  {o.endDate !== o.startDate && ` to ${formatDate(o.endDate)}`}
                  {o.note && <span className="text-loupe">. {o.note}</span>}
                </span>
                <ActionButton className="btn-quiet" action={removeTimeOffAction.bind(null, o.id)}>Remove</ActionButton>
              </li>
            ))}
          </ul>
        )}
        <div className="panel">
          <TimeOffForm key={whoseId} action={addTimeOffAction.bind(null, whoseId)} />
        </div>
      </section>
    </div>
  );
}
