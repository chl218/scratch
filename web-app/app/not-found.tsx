import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-stone-600">
        This link may have been changed or turned off. Ask your photographer for a new one.
      </p>
      <Link href="/" className="btn-secondary">Go home</Link>
    </main>
  );
}
