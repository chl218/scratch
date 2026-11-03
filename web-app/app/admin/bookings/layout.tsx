import { requireSection } from "@/lib/sections";

// Switched off for now (see lib/sections.ts).
export default function BookingsSectionLayout({ children }: LayoutProps<"/admin/bookings">) {
  requireSection("bookings");
  return children;
}
