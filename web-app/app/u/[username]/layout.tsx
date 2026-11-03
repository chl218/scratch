import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveArea } from "@/lib/area";
import { logoutAction } from "@/app/actions/auth";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

// The client area (F17). Not found for anyone who isn't this client or holding one of their links.
export default async function ClientAreaLayout(props: LayoutProps<"/u/[username]">) {
  const { username } = await props.params;
  const area = await resolveArea(username);
  if (!area) notFound();
  const base = `/u/${username}`;
  const tabs = [
    { href: base, label: "Shoots" },
    ...(area.loggedIn
      ? [
          { href: `${base}/messages`, label: "Messages" },
          { href: `${base}/bookings`, label: "Bookings" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-sleeve pb-3 pt-4">
          <div>
            <p className="text-sm text-loupe">My studio</p>
            <h1 className="display text-[36px] sm:text-[48px]">{area.client.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <nav aria-label="Client area" className="flex gap-4">
              {tabs.map((t) => (
                <Link key={t.href} href={t.href} className="font-semibold hover:underline">
                  {t.label}
                </Link>
              ))}
            </nav>
            {area.loggedIn ? (
              <form action={logoutAction}>
                <button type="submit" className="btn-quiet">Log out</button>
              </form>
            ) : area.client.userId ? (
              <Link href={`/login?next=${encodeURIComponent(base)}`} className="btn-secondary">
                Log in for messages and booking
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <main className="w-full px-4 py-6 sm:px-6">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
