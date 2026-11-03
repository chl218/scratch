import { requireAdmin } from "@/lib/auth";
import { LibraryTabs } from "@/components/LibraryTabs";

// The reference library (F1, F2): a Pictures tab to search and edit, and an Upload tab.
export default async function LibraryLayout({ children }: LayoutProps<"/admin/library">) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-[36px]">Reference library</h1>
        <LibraryTabs />
      </div>
      {children}
    </div>
  );
}
