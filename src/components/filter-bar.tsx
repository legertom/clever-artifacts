"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SCOPE_LABELS, SORT_LABELS, type Facets, type Scope, type Sort } from "@/lib/artifacts";
import { toSearchParams, VIEWS_OPTIONS, WITHIN_OPTIONS, type ParsedQuery } from "@/lib/search-params";

type Props = {
  value: ParsedQuery;
  facets: Facets;
  action: string;
  /** Extra params to carry along (e.g. the dashboard tab). */
  hidden?: Record<string, string>;
  showScope?: boolean;
  showSearch?: boolean;
  showVisibility?: boolean;
  domain: string;
  clearHref: string;
  activeCount: number;
  /** Text shown at the left of the toolbar, e.g. "12 results". */
  summary?: string;
};

/**
 * Slim toolbar: [search] [Sort ▾] [Filters ▾]. Filters live in a panel that is
 * closed by default and stays open while any filter is on. Every control
 * re-submits the GET form, so the URL always describes the view.
 */
export function FilterBar({
  value,
  facets,
  action,
  hidden = {},
  showScope = true,
  showSearch = true,
  showVisibility = true,
  domain,
  clearHref,
  activeCount,
  summary,
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (value.panelOpen || activeCount > 0);
  const submit = () => form.current?.requestSubmit();
  const sort: Sort = value.sort ?? (value.q ? "relevance" : "updated");

  const without = (mutate: (p: ParsedQuery) => void) => {
    const next: ParsedQuery = { ...value, tags: [...value.tags] };
    mutate(next);
    const qs = toSearchParams(next, hidden).toString();
    return qs ? `${action}?${qs}` : action;
  };

  const chips: { label: string; href: string }[] = [];
  if (showScope && value.scope !== "all") chips.push({ label: scopeLabel(value.scope, domain), href: without((p) => (p.scope = "all")) });
  if (value.owner) {
    const o = facets.owners.find((x) => x.email === value.owner);
    chips.push({ label: `Owner: ${o?.name ?? value.owner}`, href: without((p) => (p.owner = undefined)) });
  }
  for (const t of value.tags) chips.push({ label: `#${t}`, href: without((p) => (p.tags = p.tags.filter((x) => x !== t))) });
  if (value.visibility) chips.push({ label: `Access: ${visibilityLabel(value.visibility, domain)}`, href: without((p) => (p.visibility = undefined)) });
  if (value.updatedWithinDays) chips.push({ label: `Updated: ${withinLabel(value.updatedWithinDays)}`, href: without((p) => (p.updatedWithinDays = undefined)) });
  if (value.createdWithinDays) chips.push({ label: `Uploaded: ${withinLabel(value.createdWithinDays)}`, href: without((p) => (p.createdWithinDays = undefined)) });
  if (value.minViews) chips.push({ label: VIEWS_OPTIONS.find((o) => o.value === value.minViews)?.label ?? "Popular", href: without((p) => (p.minViews = undefined)) });
  if (value.preview) chips.push({ label: value.preview === "ready" ? "Has preview" : "Missing preview", href: without((p) => (p.preview = undefined)) });

  return (
    <form ref={form} action={action} method="get" className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {open ? <input type="hidden" name="fx" value="1" /> : null}
      {!showSearch && value.q ? <input type="hidden" name="q" value={value.q} /> : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {showSearch ? (
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon />
            <input
              type="search"
              name="q"
              defaultValue={value.q}
              placeholder="Search by name, description, #tag or person"
              aria-label="Search"
              autoComplete="off"
              className="input h-10 pl-9"
            />
          </div>
        ) : summary ? (
          <span className="mr-auto text-sm text-neutral-500">{summary}</span>
        ) : (
          <span className="mr-auto" />
        )}

        {showScope ? (
          <PillSelect name="scope" label="Show" value={value.scope} onChange={submit}>
            {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
              <option key={s} value={s}>
                {scopeLabel(s, domain)}
              </option>
            ))}
          </PillSelect>
        ) : null}

        <PillSelect name="sort" label="Sort" value={sort} onChange={submit}>
          {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </PillSelect>

        <button
          type="button"
          onClick={() => setToggled(!open)}
          aria-expanded={open}
          className={`btn h-10 gap-1.5 px-3 ${open || activeCount ? "border-brand-300 bg-brand-50 text-brand-800" : "btn-secondary"}`}
        >
          <FilterIcon />
          Filters
          {activeCount ? (
            <span className="rounded-full bg-brand-600 px-1.5 text-[11px] leading-4 text-white">{activeCount}</span>
          ) : null}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`transition ${open ? "rotate-180" : ""}`} aria-hidden>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Active filters */}
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1.5 text-xs text-brand-800 hover:bg-brand-100"
              title="Remove this filter"
            >
              {c.label}
              <span className="grid size-4 place-items-center rounded-full text-brand-500" aria-hidden>
                ×
              </span>
            </Link>
          ))}
          <Link href={clearHref} className="ml-1 text-xs text-neutral-500 hover:text-neutral-800">
            Clear all
          </Link>
        </div>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Field name="owner" label="Owner" value={value.owner ?? ""} onChange={submit}>
              <option value="">Anyone</option>
              {facets.owners.map((o) => (
                <option key={o.email} value={o.email}>
                  {(o.name ?? o.email) + ` (${o.count})`}
                </option>
              ))}
            </Field>
            <Field name="updated" label="Updated" value={String(value.updatedWithinDays ?? "")} onChange={submit}>
              <option value="">Any time</option>
              {WITHIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Field>
            <Field name="created" label="Uploaded" value={String(value.createdWithinDays ?? "")} onChange={submit}>
              <option value="">Any time</option>
              {WITHIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Field>
            <Field name="views" label="Popularity" value={String(value.minViews ?? "")} onChange={submit}>
              <option value="">Any</option>
              {VIEWS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Field>
            <Field name="preview" label="Preview" value={value.preview ?? ""} onChange={submit}>
              <option value="">Any</option>
              <option value="ready">Has preview</option>
              <option value="missing">Missing preview</option>
            </Field>
            {showVisibility ? (
              <Field name="visibility" label="Access" value={value.visibility ?? ""} onChange={submit}>
                <option value="">Any</option>
                <option value="private">Only owner</option>
                <option value="restricted">Specific people</option>
                <option value="domain">Everyone at {domain}</option>
              </Field>
            ) : null}
          </div>

          {facets.tags.length ? (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {facets.tags.map((t) => {
                  const on = value.tags.includes(t.tag);
                  return (
                    <label
                      key={t.tag}
                      className={`cursor-pointer select-none rounded-full border px-2.5 py-0.5 text-xs transition ${
                        on
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <input type="checkbox" name="tag" value={t.tag} checked={on} onChange={submit} className="sr-only" />
                      #{t.tag}
                      <span className={on ? "ml-1 text-brand-200" : "ml-1 text-neutral-400"}>{t.count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-end gap-2 text-xs">
            <noscript>
              <button type="submit" className="btn-secondary px-2 py-1 text-xs">
                Apply
              </button>
            </noscript>
            {activeCount ? (
              <Link href={clearHref} className="btn-ghost px-2 py-1 text-xs">
                Reset filters
              </Link>
            ) : null}
            <button type="button" onClick={() => setToggled(false)} className="btn-ghost px-2 py-1 text-xs">
              Hide
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function scopeLabel(s: Scope, domain: string): string {
  return s === "company" ? `Open to everyone at ${domain}` : SCOPE_LABELS[s];
}
function visibilityLabel(v: NonNullable<ParsedQuery["visibility"]>, domain: string): string {
  return v === "private" ? "only owner" : v === "restricted" ? "specific people" : `everyone at ${domain}`;
}
function withinLabel(days: number): string {
  return (WITHIN_OPTIONS.find((o) => o.value === days)?.label ?? `last ${days} days`).toLowerCase();
}

/** Compact select with its label inside the pill: "Sort · Recently updated ▾". */
function PillSelect({
  name,
  label,
  value,
  onChange,
  children,
}: {
  name: string;
  label: string;
  value: string;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white pl-3 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
      <span className="pointer-events-none text-xs text-neutral-500">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        aria-label={label}
        className="h-full cursor-pointer appearance-none bg-transparent py-0 pl-2 pr-8 text-sm font-medium text-neutral-900 outline-none"
      >
        {children}
      </select>
      <Chevron />
    </label>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  children,
}: {
  name: string;
  label: string;
  value: string;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="relative block">
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-neutral-300 bg-white pl-3 pr-8 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {children}
        </select>
        <Chevron />
      </span>
    </label>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
