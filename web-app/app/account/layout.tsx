import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const { client } = await requireClient();
  return (
    <div className="flex-1">
      <nav className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/account" className="font-semibold">
            Moodboard
          </Link>
          <Link href="/account" className="text-sm text-stone-600 hover:text-stone-900">
            My shoots
          </Link>
          <Link href="/account/messages" className="text-sm text-stone-600 hover:text-stone-900">
            Messages
          </Link>
          <Link href="/account/payments" className="text-sm text-stone-600 hover:text-stone-900">
            Payments
          </Link>
          <span className="ml-auto text-sm text-stone-500">{client.name}</span>
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
