import "server-only";
import { notFound } from "next/navigation";

// Admin sections that are switched off for now. Their pages show "not found" and
// they're left out of the admin menu; the code stays so they can come back.
// To bring one back, remove it from DEFAULT_HIDDEN (or set ADMIN_HIDDEN_SECTIONS="").
export type AdminSection = "clients" | "inbox" | "bookings" | "team";

const DEFAULT_HIDDEN = "clients,inbox,bookings,team";

function hidden(): Set<string> {
  const value = process.env.ADMIN_HIDDEN_SECTIONS ?? DEFAULT_HIDDEN;
  return new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
}

export function sectionOn(section: AdminSection): boolean {
  return !hidden().has(section);
}

/** Call at the top of a section's layout. */
export function requireSection(section: AdminSection): void {
  if (!sectionOn(section)) notFound();
}
