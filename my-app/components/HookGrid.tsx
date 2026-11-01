"use client";

import { useMemo, useState } from "react";
import { HookCard } from "@/components/HookCard";
import { repoLabel, type Hook } from "@/lib/hooks";

const SEARCH_MAX_LENGTH = 100;

function countLabel(n: number): string {
  return `${n} ${n === 1 ? "hook" : "hooks"}`;
}

export function HookGrid({ hooks }: { hooks: Hook[] }) {
  const [query, setQuery] = useState("");

  // Lowercased text each hook is searched against.
  const searchable = useMemo(
    () =>
      hooks.map((hook) => ({
        hook,
        text: [hook.name, hook.description, hook.category, repoLabel(hook.repoUrl)]
          .join(" ")
          .toLowerCase(),
      })),
    [hooks],
  );

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visible =
    terms.length === 0
      ? hooks
      : searchable
          .filter(({ text }) => terms.every((term) => text.includes(term)))
          .map(({ hook }) => hook);

  return (
    <>
      <div className="relative mb-4 max-w-xl">
        <label htmlFor="hook-search" className="sr-only">
          Search hooks
        </label>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" />
        </svg>
        <input
          id="hook-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Search hooks by name, category or description"
          autoComplete="off"
          className="w-full rounded-xl border border-black/15 bg-white py-2.5 pl-10 pr-4 text-base text-zinc-950 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:outline-blue-400"
        />
      </div>

      <p
        role="status"
        className="mb-4 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {terms.length === 0
          ? countLabel(hooks.length)
          : `${visible.length} of ${countLabel(hooks.length)}`}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-10 text-center text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          No hooks match &ldquo;{query.trim()}&rdquo;.{" "}
          <button
            type="button"
            onClick={() => setQuery("")}
            className="font-medium text-zinc-950 underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-50 dark:focus-visible:outline-blue-400"
          >
            Clear search
          </button>
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((hook) => (
            <li key={hook.id}>
              <HookCard hook={hook} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
