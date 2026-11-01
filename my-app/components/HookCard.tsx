import { repoLabel, type Category, type Hook } from "@/lib/hooks";

// Full class strings so Tailwind can detect them.
const CATEGORY_STYLES: Record<Category, string> = {
  Security:
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  Formatting:
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  Testing:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  Notifications:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  Git: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  "Logging & Monitoring":
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  Productivity:
    "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  Other: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

export function HookCard({ hook }: { hook: Hook }) {
  const label = repoLabel(hook.repoUrl);

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-zinc-900">
      <div className="flex flex-col items-start gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[hook.category]}`}
        >
          {hook.category}
        </span>
        <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
          {hook.name}
        </h2>
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {hook.description}
      </p>

      <a
        href={hook.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex flex-wrap items-center gap-x-1.5 pt-2 text-sm font-medium text-zinc-950 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        <span aria-hidden="true">View on GitHub ↗</span>
        <span className="font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400" aria-hidden="true">
          {label}
        </span>
        <span className="sr-only">
          View {label} on GitHub (opens in new tab)
        </span>
      </a>
    </article>
  );
}
