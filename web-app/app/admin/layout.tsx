import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { usingLocalOutbox } from "@/lib/mail";
import { logoutAction } from "@/app/actions/auth";

// Admin area (SPEC §5): same tokens as the public site, but dense and quiet.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const db = await getDb();
  const [[unread], [contact], [pending]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(eq(schema.messages.sender, "client"), isNull(schema.messages.readAt))),
    db.select({ n: count() }).from(schema.contactMessages).where(isNull(schema.contactMessages.handledAt)),
    db.select({ n: count() }).from(schema.adminInvites).where(eq(schema.adminInvites.status, "pending")),
  ]);

  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/library", label: "Library" },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/inbox", label: "Inbox", badge: unread.n + contact.n },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/team", label: "Team", badge: user.isSuperAdmin ? pending.n : 0 },
    { href: "/admin/settings", label: "Settings" },
    ...(usingLocalOutbox() ? [{ href: "/admin/outbox", label: "Outbox" }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-sleeve bg-sheet md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-4 p-4 md:sticky md:top-0">
          <Link href="/" className="display text-[24px]">ReferenceMePlzQQ</Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-1 text-sm md:flex-col">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center justify-between gap-2 py-0.5 hover:underline">
                {l.label}
                {l.badge ? (
                  <span className="rounded-full bg-marker px-1.5 text-xs font-semibold text-white">{l.badge}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="text-xs text-loupe">
            <p className="font-semibold text-graphite">{user.name}</p>
            <p>{user.isSuperAdmin ? "Super Admin" : "Admin"}</p>
            <form action={logoutAction} className="mt-1">
              <button type="submit" className="cursor-pointer underline underline-offset-2 hover:text-graphite">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
