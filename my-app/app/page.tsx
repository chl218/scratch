import { HookGrid } from "@/components/HookGrid";
import { CONTRIBUTE_URL, getHooks } from "@/lib/hooks";

const linkClass =
  "font-medium underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

export default function Home() {
  const hooks = getHooks();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="mx-auto w-full max-w-7xl px-4 pb-6 pt-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight">HookHub</h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          Discover open-source hooks for Claude Code.
        </p>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        {hooks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-10 text-center text-zinc-600 dark:border-white/20 dark:text-zinc-400">
            No hooks yet —{" "}
            <a
              href={CONTRIBUTE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              be the first to add one
            </a>
            .
          </p>
        ) : (
          <HookGrid hooks={hooks} />
        )}
      </main>

      <footer className="border-t border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-zinc-600 sm:px-6 lg:px-8 dark:text-zinc-400">
          <p>
            HookHub links to third-party code. Review any hook before installing
            it. HookHub doesn&apos;t audit or endorse listed hooks.
          </p>
          <p>
            <a
              href={CONTRIBUTE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Add a hook
            </a>{" "}
            by opening a pull request that edits{" "}
            <code className="font-mono">data/hooks.json</code>.
          </p>
        </div>
      </footer>
    </div>
  );
}
