"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { parseTags } from "@/lib/shared";

const MAX_SUGGESTIONS = 8;

/**
 * Tag search with suggestions while typing (F2). Suggests tags that start with the
 * word being typed, most used first. Picking one runs the search straight away.
 */
export function TagSearch({
  action,
  initial,
  tags,
  placeholder = "Search by tags, e.g. #moody #portrait",
  quiet = false,
}: {
  /** The page to search: tags go in its ?tags= parameter. */
  action: string;
  initial: string[];
  tags: { name: string; count: number }[];
  placeholder?: string;
  /** A plain underlined field for public pages, so it doesn't compete with the photos. */
  quiet?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(initial.map((t) => `#${t}`).join(" ") + (initial.length ? " " : ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // The word being typed is everything after the last space.
  const lastSpace = value.lastIndexOf(" ");
  const typing = value.slice(lastSpace + 1).replace(/^#+/, "").toLowerCase();
  const chosen = parseTags(value.slice(0, lastSpace + 1));
  const suggestions = typing
    ? tags.filter((t) => t.name.startsWith(typing) && !chosen.includes(t.name)).slice(0, MAX_SUGGESTIONS)
    : [];
  const showing = open && suggestions.length > 0;

  function go(text: string) {
    const list = parseTags(text);
    setOpen(false);
    router.push(list.length ? `${action}?tags=${list.join(",")}` : action);
  }

  function pick(name: string) {
    const text = `${value.slice(0, lastSpace + 1)}#${name} `;
    setValue(text);
    go(text);
  }

  return (
    <form
      role="search"
      className={`relative flex gap-2 ${quiet ? "max-w-sm items-end" : "max-w-xl"}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (showing) pick(suggestions[active].name);
        else go(value);
      }}
    >
      <div className="relative flex-1">
        <label htmlFor={`${listId}-input`} className="sr-only">Search by tags</label>
        <input
          id={`${listId}-input`}
          className={
            quiet
              ? "w-full border-0 border-b border-sleeve bg-transparent px-0 py-1.5 text-[16px] outline-none placeholder:text-loupe focus:border-graphite sm:text-[15px]"
              : "input"
          }
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showing}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showing ? `${listId}-opt-${active}` : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Tab") {
              e.preventDefault();
              setValue(`${value.slice(0, lastSpace + 1)}#${suggestions[active].name} `);
            }
          }}
        />
        {showing && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label="Matching tags"
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[6px] border border-sleeve bg-sheet py-1 text-sm shadow-[0_6px_20px_rgba(31,37,41,0.12)]"
          >
            {suggestions.map((t, i) => (
              <li
                key={t.name}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click, so the input doesn't blur and close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(t.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer justify-between gap-3 px-3 py-1.5 ${i === active ? "bg-table" : ""}`}
              >
                <span>
                  <span className="font-semibold">#{t.name.slice(0, typing.length)}</span>
                  {t.name.slice(typing.length)}
                </span>
                <span className="text-loupe">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className={quiet ? "cursor-pointer px-1 pb-1.5 text-[15px] hover:underline hover:underline-offset-[7px]" : "btn-primary"}>
        Search
      </button>
    </form>
  );
}
