import { requireSection } from "@/lib/sections";

// Switched off for now (see lib/sections.ts).
export default function TeamSectionLayout({ children }: LayoutProps<"/admin/team">) {
  requireSection("team");
  return children;
}
