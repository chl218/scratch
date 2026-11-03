"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/library", label: "Pictures" },
  { href: "/admin/library/upload", label: "Upload" },
];

export function LibraryTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Library" className="flex gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className={`pill ${path === t.href ? "pill-on" : ""}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
