import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { usingLocalOutbox } from "@/lib/mail";
import { logoutAction } from "@/app/actions/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const db = await getDb();
  const [unread] = await db
    .select({ n: count() })
    .from(schema.messages)
    .where(and(eq(schema.messages.sender, "client"), isNull(schema.messages.readAt)));

  const links = [
    { href: "/admin/library", label: "Library" },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/inbox", label: "Inbox", badge: unread.n },
    { href: "/admin/payments", label: "Payments" },
    ...(usingLocalOutbox() ? [{ href: "/admin/outbox", label: "Outbox" }] : []),
  ];

  return (
    <div className="flex-1">
      <nav className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Moodboard
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-stone-600 hover:text-stone-900">
              {l.label}
              {l.badge ? (
                <span className="ml-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-xs text-white">{l.badge}</span>
              ) : null}
            </Link>
          ))}
          <span className="ml-auto text-sm text-stone-500">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer text-sm text-stone-600 hover:text-stone-900">
              Log out
            </button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
