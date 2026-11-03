import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tryPageAccess } from "@/lib/access";
import { ClientPageView } from "@/components/ClientPageView";
import { RememberLink } from "@/components/ClientBoard";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = { title: "Your shoot", referrer: "no-referrer", robots: { index: false } };

// The private link (F3). No login needed.
export default async function PrivateLinkPage(props: PageProps<"/c/[token]">) {
  const { token } = await props.params;
  const access = await tryPageAccess(`t:${token}`);
  if (!access) notFound();

  return (
    <div className="flex flex-1 flex-col">
      {access.actor.type === "client" && <RememberLink token={token} />}
      <SiteHeader />
      <main className="w-full px-4 pb-6 sm:px-8 lg:px-11">
        <Link href="/" className="btn-quiet -ml-2 mb-2">Home</Link>
        <ClientPageView access={access} path={`/c/${token}`} />
      </main>
      <SiteFooter />
    </div>
  );
}
