import Link from "next/link";
import { getCurrentClient, getCurrentUser } from "@/lib/auth";
import { linkedClients } from "@/lib/links";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Overview" },
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
    <header className="px-4 pb-6 pt-7 sm:px-8 sm:pb-10 sm:pt-10 lg:px-11">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <Link href="/" className="wordmark text-[20px] sm:text-[22px]">
          ReferenceMePlzQQ
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              className={current === n.href ? "underline decoration-1 underline-offset-[7px]" : "hover:underline hover:decoration-1 hover:underline-offset-[7px]"}
            >
              {n.label}
            </Link>
          ))}
          <Link href={account.href} className="text-loupe hover:text-graphite">
            {account.label}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 px-4 pb-8 pt-16 text-sm text-loupe sm:px-8 lg:px-11">
      <span>ReferenceMePlzQQ, a small studio among friends.</span>
      <ThemeToggle />
    </footer>
  );
}
