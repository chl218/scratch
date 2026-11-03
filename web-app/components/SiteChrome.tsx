import Link from "next/link";
import { getCurrentClient, getCurrentUser } from "@/lib/auth";
import { linkedClients } from "@/lib/links";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Work" },
  { href: "/team", label: "Meet the team" },
  { href: "/book", label: "Book" },
  { href: "/contact", label: "Contact" },
];

/** Where the header's account link goes: the admin area, the client's area, or log in. */
async function accountLink(): Promise<{ href: string; label: string }> {
  const user = await getCurrentUser();
  if (user?.role === "admin") return { href: "/admin", label: "Admin" };
  const client = await getCurrentClient();
  if (client?.client.username) return { href: `/u/${client.client.username}`, label: "My studio" };
  const linked = await linkedClients();
  if (linked[0]?.username) return { href: `/u/${linked[0].username}`, label: "My studio" };
  return { href: "/login", label: "Log in" };
}

/** Header for the public pages and the client area (F13). */
export async function SiteHeader({ current }: { current?: string }) {
  const account = await accountLink();
  return (
    <header className="px-4 pb-3 pt-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Link href="/" className="display text-[28px] sm:text-[36px]">
          ReferenceMePlzQQ
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              className={current === n.href ? "font-semibold underline decoration-marker decoration-2 underline-offset-[6px]" : "text-loupe hover:text-graphite"}
            >
              {n.label}
            </Link>
          ))}
          <Link href={account.href} className="font-semibold">
            {account.label}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-loupe sm:px-6">
      <span>ReferenceMePlzQQ, a small studio among friends.</span>
      <ThemeToggle />
    </footer>
  );
}
