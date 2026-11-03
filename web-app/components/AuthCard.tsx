import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6">
      <Link href="/" className="display text-[28px]">ReferenceMePlzQQ</Link>
      <div className="mx-auto mt-12 w-full max-w-sm space-y-6 sm:mt-20">
        <div className="space-y-2">
          <h1 className="display text-[48px]">{title}</h1>
          {subtitle && <p className="text-loupe">{subtitle}</p>}
        </div>
        <div className="panel">{children}</div>
      </div>
    </main>
  );
}
