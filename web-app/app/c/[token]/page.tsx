import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tryPageAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { ClientPageView } from "@/components/ClientPageView";

export const metadata: Metadata = { title: "Your shoot", referrer: "no-referrer" };

// The private link (F3). No login needed.
export default async function PrivateLinkPage(props: PageProps<"/c/[token]">) {
  const { token } = await props.params;
  const access = await tryPageAccess(`t:${token}`);
  if (!access) notFound();
  const user = await getCurrentUser();

  return (
    <div className="flex-1">
      <nav className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Moodboard</span>
          {user ? (
            <Link href={user.role === "admin" ? "/admin" : "/account"} className="text-sm text-stone-600 hover:text-stone-900">
              {user.role === "admin" ? "Admin" : "My account"}
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900">
              Log in to message your photographer
            </Link>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ClientPageView access={access} />
      </main>
    </div>
  );
}
