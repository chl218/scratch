"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { openDaysAction, slotsAction } from "@/app/actions/booking";
import { bookAction, rescheduleBookingAction } from "@/app/actions/client";
import type { Slot } from "@/lib/booking";
import { addDays, formatDayLong, weekdayOf } from "@/lib/time";

type SessionType = { id: string; name: string; durationMinutes: number; description: string };

const DAYS = 28;
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function lengthLabel(min: number) {
  if (min % 60 === 0) return `${min / 60} h`;
  return min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

function timeLabel(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/**
 * The Book page (F15): session type → day → time and who's free → person → book.
 * Anyone can browse; booking needs a logged-in client.
 */
export function BookingFlow({
  types,
  today,
  zone,
  canBook,
  reschedule,
}: {
  types: SessionType[];
  today: string;
  zone: string;
  canBook: boolean;
  /** Set when a client is moving an existing booking. */
  reschedule?: { bookingId: string; sessionTypeId: string; label: string };
}) {
  const [typeId, setTypeId] = useState(reschedule?.sessionTypeId ?? types[0]?.id ?? "");
  const [days, setDays] = useState<Record<string, number> | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [person, setPerson] = useState<string>("any");
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const [booking, startBooking] = useTransition();

  useEffect(() => {
    if (!typeId) return;
    let stale = false;
    startLoading(async () => {
      const result = await openDaysAction(typeId, today, DAYS, reschedule?.bookingId);
      if (!stale) setDays(result);
    });
    return () => {
      stale = true;
    };
  }, [typeId, today, reschedule?.bookingId]);

  function pickType(id: string) {
    setTypeId(id);
    setDays(null);
    setDay(null);
    setSlots(null);
    setSlot(null);
  }

  function pickDay(d: string) {
    setDay(d);
    setSlot(null);
    setSlots(null);
    startLoading(async () => setSlots(await slotsAction(typeId, d, reschedule?.bookingId)));
  }

  function book() {
    if (!slot) return;
    setError("");
    startBooking(async () => {
      const input = { sessionTypeId: typeId, start: slot.start, adminId: person };
      try {
        const res = reschedule ? await rescheduleBookingAction(reschedule.bookingId, input) : await bookAction(input);
        if (res?.error) setError(res.error);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err; // redirect after booking
        setError("Booking didn't go through. Check your connection and try again.");
      }
    });
  }

  if (types.length === 0) {
    return <p className="max-w-xl text-loupe">Booking opens once the studio adds its sessions. Use the contact page to ask about dates.</p>;
  }

  const type = types.find((t) => t.id === typeId);
  // Calendar grid starts on the Sunday on or before today.
  const start = addDays(today, -weekdayOf(today));
  const cells = Array.from({ length: DAYS + weekdayOf(today) }, (_, i) => addDays(start, i));

  return (
    <div className="space-y-10">
      {!reschedule && (
        <section aria-labelledby="step-type">
          <h2 id="step-type" className="text-[21px] font-semibold">Choose a session</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === typeId}
                onClick={() => pickType(t.id)}
                className={`cursor-pointer rounded-[6px] border p-4 text-left transition-colors ${
                  t.id === typeId ? "border-marker bg-sheet" : "border-sleeve bg-sheet hover:border-graphite"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm text-loupe">{lengthLabel(t.durationMinutes)}</span>
                </span>
                {t.description && <span className="mt-1 block text-sm text-loupe">{t.description}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="step-day">
        <h2 id="step-day" className="text-[21px] font-semibold">
          {reschedule ? `Pick a new day for your ${reschedule.label}` : "Pick a day"}
        </h2>
        <p className="mt-1 text-sm text-loupe">Times shown in {zone}. Days with a number have open times.</p>
        <div className="mt-3 grid max-w-xl grid-cols-7 gap-1 text-center">
          {SHORT_DAYS.map((d) => (
            <span key={d} className="pb-1 text-xs text-loupe">{d}</span>
          ))}
          {cells.map((d) => {
            const past = d < today;
            const open = days?.[d] ?? 0;
            const chosen = d === day;
            return (
              <button
                key={d}
                type="button"
                disabled={past || !open}
                onClick={() => pickDay(d)}
                aria-pressed={chosen}
                aria-label={`${formatDayLong(d)}${open ? `, ${open} open times` : ", no open times"}`}
                className={`flex aspect-square flex-col items-center justify-center rounded-[6px] text-sm transition-colors ${
                  chosen
                    ? "bg-graphite text-on-graphite"
                    : open
                      ? "cursor-pointer border border-sleeve bg-sheet hover:border-graphite"
                      : "text-loupe/60"
                }`}
              >
                <span className="font-semibold">{Number(d.slice(8))}</span>
                {open > 0 && <span className={`text-[11px] ${chosen ? "" : "text-marker"}`}>{open}</span>}
              </button>
            );
          })}
        </div>
        {days === null && loading && <p className="mt-2 text-sm text-loupe">Checking the calendar…</p>}
        {days && Object.values(days).every((n) => n === 0) && (
          <p className="mt-3 text-sm text-loupe">No open times in the next four weeks. Use the contact page to ask about other dates.</p>
        )}
      </section>

      {day && (
        <section aria-labelledby="step-time">
          <h2 id="step-time" className="text-[21px] font-semibold">{formatDayLong(day)}</h2>
          {slots === null ? (
            <p className="mt-2 text-sm text-loupe">Loading times…</p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-sm text-loupe">That day just filled up. Pick another.</p>
          ) : (
            <ul className="mt-3 max-w-2xl divide-y divide-sleeve border-y border-sleeve">
              {slots.map((s) => {
                const chosen = slot?.start === s.start;
                return (
                  <li key={s.start}>
                    <button
                      type="button"
                      onClick={() => {
                        setSlot(s);
                        setPerson(s.free.length === 1 ? s.free[0].id : "any");
                      }}
                      aria-pressed={chosen}
                      className={`flex w-full cursor-pointer flex-wrap items-baseline gap-x-6 gap-y-1 px-2 py-3 text-left ${chosen ? "bg-sheet" : "hover:bg-sheet"}`}
                    >
                      <span className={`w-24 font-semibold ${chosen ? "text-marker" : ""}`}>{timeLabel(s.time)}</span>
                      <span className="text-sm text-loupe">Free: {s.free.map((f) => f.name).join(", ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {slot && type && (
        <section aria-labelledby="step-confirm" className="max-w-xl space-y-4">
          <h2 id="step-confirm" className="text-[21px] font-semibold">
            {type.name}, {formatDayLong(day!)} at {timeLabel(slot.time)}
          </h2>
          {slot.free.length > 1 && (
            <fieldset>
              <legend className="label">Who would you like?</legend>
              <div className="flex flex-wrap gap-2">
                {[{ id: "any", name: "Anyone available" }, ...slot.free].map((f) => (
                  <label key={f.id} className={`pill ${person === f.id ? "pill-on" : ""}`}>
                    <input
                      type="radio"
                      name="person"
                      value={f.id}
                      checked={person === f.id}
                      onChange={() => setPerson(f.id)}
                      className="sr-only"
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {canBook ? (
            <button type="button" className="btn-primary" onClick={book} disabled={booking}>
              {booking ? "Booking…" : reschedule ? "Move my booking here" : "Book this time"}
            </button>
          ) : (
            <p>
              <Link href={`/login?next=${encodeURIComponent("/book")}`} className="btn-primary">
                Log in to book
              </Link>{" "}
              <span className="ml-2 text-sm text-loupe">
                No account yet? <Link href="/contact" className="font-semibold text-graphite underline underline-offset-4">Ask the studio</Link> for an invite.
              </span>
            </p>
          )}
          {error && <p className="error-note" role="alert">⚠ {error}</p>}
        </section>
      )}
    </div>
  );
}
