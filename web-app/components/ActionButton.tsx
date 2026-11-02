"use client";

import { useState, useTransition, type ReactNode } from "react";

/** A button that runs a server action, with optional confirm and result message. */
export function ActionButton({
  action,
  children,
  className = "btn-secondary",
  confirm,
  pendingText,
}: {
  action: () => Promise<{ error?: string; ok?: string } | void | undefined>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  pendingText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: string }>({});

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setResult({});
          startTransition(async () => {
            try {
              setResult((await action()) ?? {});
            } catch (err) {
              // Redirects from actions arrive as special errors that Next handles itself.
              if (err && typeof err === "object" && "digest" in err) return;
              setResult({ error: "Something went wrong." });
            }
          });
        }}
      >
        {pending ? (pendingText ?? "Working…") : children}
      </button>
      {result.error && <span className="text-sm text-red-700">{result.error}</span>}
      {result.ok && <span className="text-sm text-emerald-700">{result.ok}</span>}
    </span>
  );
}
