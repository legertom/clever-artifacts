"use client";

import { useRef } from "react";

export type ToolbarSelect = { name: string; label: string; value: string; options: { value: string; label: string }[] };

/** GET form: search box plus selects that re-submit on change. */
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
  const form = useRef<HTMLFormElement>(null);
  const submit = () => {
    const f = form.current;
    if (!f) return;
    for (const el of Array.from(f.elements)) {
      if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name && el.value === "") el.disabled = true;
    }
    f.requestSubmit();
  };
  return (
    <form ref={form} action={action} method="get" className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[240px] flex-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" autoComplete="off" className="input h-10 pl-9" />
      </div>
      {selects.map((s) => (
        <label
          key={s.name}
          className="relative inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white pl-3 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30"
        >
          <span className="pointer-events-none text-xs text-neutral-500">{s.label}</span>
          <select
            name={s.name}
            value={s.value}
            onChange={submit}
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
