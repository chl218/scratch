import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-4 px-6 py-20 sm:px-16">
      <h1 className="display text-[32px] sm:text-[44px]">Not found</h1>
      <p className="max-w-[50ch] text-loupe">
        This link may have changed or been turned off. Ask the studio for a new one.
      </p>
      <Link href="/" className="btn-secondary">Go to the studio&apos;s home page</Link>
    </main>
  );
}
