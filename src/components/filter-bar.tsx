"use client";

import Link from "next/link";
import { useRef } from "react";
import { SCOPE_LABELS, SORT_LABELS, type Facets, type Scope, type Sort } from "@/lib/artifacts";
import { VIEWS_OPTIONS, WITHIN_OPTIONS, type ParsedQuery } from "@/lib/search-params";

/**
 * GET form that re-submits itself whenever a control changes. Works without
 * JavaScript too (Enter in the search box submits).
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
}: {
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
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const sort: Sort = value.sort ?? (value.q ? "relevance" : "updated");

  return (
    <form ref={form} action={action} method="get" className="card space-y-3 p-3 sm:p-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {showSearch ? (
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={value.q}
            placeholder="Search by name, description, #tag or person — press Enter"
            aria-label="Search"
            autoComplete="off"
            className="input pl-9"
          />
        </div>
      ) : value.q ? (
        <input type="hidden" name="q" value={value.q} />
      ) : null}

      {showScope ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Show">
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
            <label
              key={s}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                value.scope === s
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <input type="radio" name="scope" value={s} checked={value.scope === s} onChange={submit} className="sr-only" />
              {s === "company" ? `Open to everyone at ${domain}` : SCOPE_LABELS[s]}
            </label>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select name="sort" label="Sort" value={sort} onChange={submit}>
          {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select name="owner" label="Owner" value={value.owner ?? ""} onChange={submit}>
          <option value="">Anyone</option>
          {facets.owners.map((o) => (
            <option key={o.email} value={o.email}>
              {(o.name ?? o.email) + ` (${o.count})`}
            </option>
          ))}
        </Select>
        <Select name="updated" label="Updated" value={String(value.updatedWithinDays ?? "")} onChange={submit}>
          <option value="">Any time</option>
          {WITHIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="created" label="Uploaded" value={String(value.createdWithinDays ?? "")} onChange={submit}>
          <option value="">Any time</option>
          {WITHIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="views" label="Popularity" value={String(value.minViews ?? "")} onChange={submit}>
          <option value="">Any</option>
          {VIEWS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="preview" label="Preview" value={value.preview ?? ""} onChange={submit}>
          <option value="">Any</option>
          <option value="ready">Has preview</option>
          <option value="missing">Missing preview</option>
        </Select>
        {showVisibility ? (
          <Select name="visibility" label="Access" value={value.visibility ?? ""} onChange={submit}>
            <option value="">Any</option>
            <option value="private">Only owner</option>
            <option value="restricted">Specific people</option>
            <option value="domain">Everyone at {domain}</option>
          </Select>
        ) : null}
      </div>

      {facets.tags.length ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-neutral-600">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {facets.tags.map((t) => {
              const on = value.tags.includes(t.tag);
              return (
                <label
                  key={t.tag}
                  className={`cursor-pointer rounded-md border px-2 py-0.5 text-xs transition ${
                    on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <input type="checkbox" name="tag" value={t.tag} checked={on} onChange={submit} className="sr-only" />
                  #{t.tag} <span className="text-neutral-400">{t.count}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span>{activeCount ? `${activeCount} filter${activeCount === 1 ? "" : "s"} on` : "No filters"}</span>
        <div className="flex items-center gap-2">
          {activeCount || value.q ? (
            <Link href={clearHref} className="btn-ghost px-2 py-1 text-xs">
              Clear all
            </Link>
          ) : null}
          <noscript>
            <button type="submit" className="btn-secondary px-2 py-1 text-xs">
              Apply
            </button>
          </noscript>
        </div>
      </div>
    </form>
  );
}

function Select({
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
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      <select name={name} value={value} onChange={onChange} className="input py-1.5 text-[13px]">
        {children}
      </select>
    </label>
  );
}
