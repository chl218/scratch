import "server-only";
import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { getDb, schema } from "./db";
import { addDays, hmOf, minutesOf, weekdayOf, zonedDate, zonedToUtc } from "./time";

// Availability and slot finding for the Book page (SPEC F15).

const STEP_MINUTES = 30;

export type StudioSettings = typeof schema.studioSettings.$inferSelect;

export async function getSettings(): Promise<StudioSettings> {
  const db = await getDb();
  const [row] = await db.select().from(schema.studioSettings).where(eq(schema.studioSettings.id, 1));
  return row ?? { id: 1, timeZone: "America/Los_Angeles", bufferMinutes: 30, cancelCutoffHours: 48, digestDelayMinutes: 30 };
}

export type TeamMember = { id: string; name: string; sortOrder: number };

/** Admins who can be booked: not disabled, in team page order. */
export async function bookableAdmins(): Promise<TeamMember[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      displayName: schema.teamProfiles.displayName,
      sortOrder: schema.teamProfiles.sortOrder,
    })
    .from(schema.users)
    .leftJoin(schema.teamProfiles, eq(schema.teamProfiles.userId, schema.users.id))
    .where(and(eq(schema.users.role, "admin"), eq(schema.users.disabled, false)))
    .orderBy(asc(schema.teamProfiles.sortOrder), asc(schema.users.name));
  return rows.map((r) => ({ id: r.id, name: r.displayName || r.name, sortOrder: r.sortOrder ?? 0 }));
}

export type Slot = {
  /** ISO instant the session starts. */
  start: string;
  /** "HH:MM" studio time. */
  time: string;
  free: TeamMember[];
};

type DayInputs = {
  admins: TeamMember[];
  rules: (typeof schema.availabilityRules.$inferSelect)[];
  off: (typeof schema.timeOff.$inferSelect)[];
  busy: { adminId: string; startsAt: Date; endsAt: Date }[];
};

async function loadInputs(fromYmd: string, toYmd: string, settings: StudioSettings, excludeBookingId?: string): Promise<DayInputs> {
  const db = await getDb();
  const admins = await bookableAdmins();
  const ids = admins.map((a) => a.id);
  if (ids.length === 0) return { admins, rules: [], off: [], busy: [] };
  const from = zonedToUtc(addDays(fromYmd, -1), "00:00", settings.timeZone);
  const to = zonedToUtc(addDays(toYmd, 2), "00:00", settings.timeZone);
  const [rules, off, busy] = await Promise.all([
    db.select().from(schema.availabilityRules).where(inArray(schema.availabilityRules.adminId, ids)),
    db.select().from(schema.timeOff).where(inArray(schema.timeOff.adminId, ids)),
    db
      .select({ adminId: schema.bookings.adminId, startsAt: schema.bookings.startsAt, endsAt: schema.bookings.endsAt })
      .from(schema.bookings)
      .where(
        and(
          inArray(schema.bookings.adminId, ids),
          eq(schema.bookings.status, "confirmed"),
          gte(schema.bookings.endsAt, from),
          lt(schema.bookings.startsAt, to),
          excludeBookingId ? ne(schema.bookings.id, excludeBookingId) : undefined,
        ),
      ),
  ]);
  return { admins, rules, off, busy };
}

function slotsFromInputs(ymd: string, durationMinutes: number, settings: StudioSettings, input: DayInputs): Slot[] {
  const weekday = weekdayOf(ymd);
  const now = Date.now();
  const buffer = settings.bufferMinutes * 60000;
  const byTime = new Map<string, Slot>();

  for (const admin of input.admins) {
    if (input.off.some((o) => o.adminId === admin.id && o.startDate <= ymd && ymd <= o.endDate)) continue;
    const windows = input.rules.filter((r) => r.adminId === admin.id && r.weekday === weekday);
    for (const w of windows) {
      const last = minutesOf(w.endTime) - durationMinutes;
      for (let m = minutesOf(w.startTime); m <= last; m += STEP_MINUTES) {
        const time = hmOf(m);
        const start = zonedToUtc(ymd, time, settings.timeZone);
        const s = start.getTime();
        const e = s + durationMinutes * 60000;
        if (s <= now) continue;
        const clash = input.busy.some(
          (b) => b.adminId === admin.id && s < b.endsAt.getTime() + buffer && e > b.startsAt.getTime() - buffer,
        );
        if (clash) continue;
        const slot = byTime.get(time) ?? { start: start.toISOString(), time, free: [] };
        if (!slot.free.some((f) => f.id === admin.id)) slot.free.push(admin);
        byTime.set(time, slot);
      }
    }
  }
  const order = new Map(input.admins.map((a, i) => [a.id, i]));
  return [...byTime.values()]
    .map((s) => ({ ...s, free: s.free.sort((a, b) => order.get(a.id)! - order.get(b.id)!) }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Start times on one day where the whole session fits, with who is free at each. */
export async function slotsForDay(
  ymd: string,
  durationMinutes: number,
  opts: { excludeBookingId?: string } = {},
): Promise<Slot[]> {
  const settings = await getSettings();
  const input = await loadInputs(ymd, ymd, settings, opts.excludeBookingId);
  return slotsFromInputs(ymd, durationMinutes, settings, input);
}

/** For the calendar: how many start times each day has, for `days` days from `fromYmd`. */
export async function openDays(
  fromYmd: string,
  days: number,
  durationMinutes: number,
  opts: { excludeBookingId?: string } = {},
): Promise<Record<string, number>> {
  const settings = await getSettings();
  const toYmd = addDays(fromYmd, days - 1);
  const input = await loadInputs(fromYmd, toYmd, settings, opts.excludeBookingId);
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const ymd = addDays(fromYmd, i);
    out[ymd] = slotsFromInputs(ymd, durationMinutes, settings, input).length;
  }
  return out;
}

/**
 * "Anyone available": the free admin with the fewest bookings that week
 * (Monday–Sunday, studio time), ties broken by team page order.
 */
export async function pickAnyone(startIso: string, free: TeamMember[], settings: StudioSettings): Promise<TeamMember> {
  if (free.length === 1) return free[0];
  const db = await getDb();
  const ymd = zonedDate(new Date(startIso), settings.timeZone);
  const monday = addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
  const from = zonedToUtc(monday, "00:00", settings.timeZone);
  const to = zonedToUtc(addDays(monday, 7), "00:00", settings.timeZone);
  const rows = await db
    .select({ adminId: schema.bookings.adminId })
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.adminId, free.map((f) => f.id)),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
    );
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.adminId, (count.get(r.adminId) ?? 0) + 1);
  return [...free].sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) || a.sortOrder - b.sortOrder)[0];
}
