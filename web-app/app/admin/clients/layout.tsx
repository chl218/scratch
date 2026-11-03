import { requireSection } from "@/lib/sections";

// Switched off for now (see lib/sections.ts).
export default function ClientsSectionLayout({ children }: LayoutProps<"/admin/clients">) {
  requireSection("clients");
  return children;
}
