import { requireSection } from "@/lib/sections";

// Switched off for now (see lib/sections.ts).
export default function InboxSectionLayout({ children }: LayoutProps<"/admin/inbox">) {
  requireSection("inbox");
  return children;
}
