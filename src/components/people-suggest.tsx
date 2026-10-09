"use client";

import { useEffect, useState } from "react";
import { initials } from "@/lib/format";

export type Person = { email: string; name: string | null; image: string | null; title?: string | null; department?: string | null };

/** Debounced people lookup against /api/users. */
export function usePeopleSuggestions(query: string, { includeSelf = false, enabled = true } = {}) {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      if (includeSelf) params.set("all", "1");
      fetch(`/api/users?${params}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d: { users: Person[] }) => setPeople(d.users ?? []))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, includeSelf, enabled]);
  return people;
}

/** Styled suggestion popover. Mouse selection uses onMouseDown so the input's blur doesn't fire first. */
export function SuggestionList({
  people,
  activeIndex,
  onPick,
  onHover,
  id,
  emptyText,
}: {
  people: Person[];
  activeIndex: number;
  onPick: (p: Person) => void;
  onHover: (i: number) => void;
  id: string;
  emptyText?: string;
}) {
  if (!people.length && !emptyText) return null;
  return (
    <ul
      id={id}
      role="listbox"
      className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
    >
      {people.length === 0 ? (
        <li className="px-3 py-2 text-xs text-neutral-500">{emptyText}</li>
      ) : (
        people.map((p, i) => (
          <li
            key={p.email}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(p);
            }}
            onMouseEnter={() => onHover(i)}
            className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${i === activeIndex ? "bg-brand-50" : ""}`}
          >
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" width={26} height={26} referrerPolicy="no-referrer" className="size-[26px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800" aria-hidden>
                {initials(p.name, p.email)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-neutral-900">{p.name ?? p.email}</span>
                {p.name ? <span className="truncate text-xs text-neutral-500">{p.email}</span> : null}
              </span>
              {p.title || p.department ? (
                <span className="block truncate text-xs text-neutral-500">{[p.title, p.department].filter(Boolean).join(" · ")}</span>
              ) : null}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
