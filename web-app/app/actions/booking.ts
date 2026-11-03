"use server";

// Public availability for the Book page (F15). Anyone can browse; booking itself is in client.ts.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { openDays, slotsForDay, type Slot } from "@/lib/booking";

const id = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function sessionLength(sessionTypeId: string): Promise<number | null> {
  const db = await getDb();
  const [type] = await db
    .select({ minutes: schema.sessionTypes.durationMinutes })
    .from(schema.sessionTypes)
    .where(and(eq(schema.sessionTypes.id, id.parse(sessionTypeId)), eq(schema.sessionTypes.active, true)));
  return type?.minutes ?? null;
}

/** A booking's own time doesn't block rescheduling it, but only for its owner. */
async function ownBookingId(bookingId?: string): Promise<string | undefined> {
  if (!bookingId) return undefined;
  const found = await getCurrentClient();
  if (!found) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, id.parse(bookingId)), eq(schema.bookings.clientId, found.client.id)));
  return row?.id;
}

export async function openDaysAction(sessionTypeId: string, from: string, days: number, bookingId?: string) {
  const minutes = await sessionLength(sessionTypeId);
  if (!minutes) return {};
  return openDays(ymd.parse(from), z.number().int().min(1).max(62).parse(days), minutes, {
    excludeBookingId: await ownBookingId(bookingId),
  });
}

export async function slotsAction(sessionTypeId: string, day: string, bookingId?: string): Promise<Slot[]> {
  const minutes = await sessionLength(sessionTypeId);
  if (!minutes) return [];
  return slotsForDay(ymd.parse(day), minutes, { excludeBookingId: await ownBookingId(bookingId) });
}
