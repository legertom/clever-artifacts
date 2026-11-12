"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { Spinner } from "@/components/upload-form";

export type ToolbarSelect = { name: string; label: string; value: string; options: { value: string; label: string }[] };

/** How long to wait after the last keystroke before searching. */
const TYPING_DELAY_MS = 250;

/**
 * Search box plus selects for an admin list. Filters as you type (and at once on
 * Enter or a select change) by putting the fields in the URL, which the page reads.
 * Without JavaScript it still works as a plain GET form.
 */
export function AdminToolbar({
  action,
  q,
  placeholder,
  selects = [],
  summary,
}: {
  action: string;
  q: string;
  placeholder: string;
  selects?: ToolbarSelect[];
  summary?: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, start] = useTransition();

  /** Navigate to the list filtered by the form's current values. Leaving `page` out returns to page 1. */
  function apply() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const f = form.current;
    if (!f) return;
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(f)) {
      const v = typeof value === "string" ? value.trim() : "";
      if (v) params.set(name, v);
    }
    const qs = params.toString();
    start(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  function applySoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, TYPING_DELAY_MS);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <form
      ref={form}
      action={action}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative min-w-[240px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          {pending ? (
            <Spinner />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          onChange={applySoon}
          placeholder={placeholder}
          aria-label="Search"
          autoComplete="off"
          className="input h-10 pl-9"
        />
      </div>
      {selects.map((s) => (
        <label
          key={s.name}
          className="relative inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white pl-3 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30"
        >
          <span className="pointer-events-none text-xs text-neutral-500">{s.label}</span>
          {/* Uncontrolled so the choice shows at once; the key re-syncs it when the URL changes some other way. */}
          <select
            key={s.value}
            name={s.name}
            defaultValue={s.value}
            onChange={apply}
            aria-label={s.label}
            className="h-full cursor-pointer appearance-none bg-transparent py-0 pl-2 pr-8 text-sm font-medium text-neutral-900 outline-none"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
      ))}
      {summary ? <span className="w-full text-xs text-neutral-500 sm:ml-auto sm:w-auto">{summary}</span> : null}
    </form>
  );
}
