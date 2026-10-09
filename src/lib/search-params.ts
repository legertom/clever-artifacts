import { SCOPES, SORTS, type ArtifactQuery, type Scope, type Sort } from "@/lib/artifacts";

export type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
function many(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
}
function num(v: string, allowed: number[]): number | undefined {
  const n = Number(v);
  return allowed.includes(n) ? n : undefined;
}

export const WITHIN_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last year" },
];
export const VIEWS_OPTIONS = [
  { value: 1, label: "Viewed at least once" },
  { value: 10, label: "10+ views" },
  { value: 50, label: "50+ views" },
  { value: 100, label: "100+ views" },
];

export type ParsedQuery = ArtifactQuery & { scope: Scope; sort?: Sort; q: string; tags: string[]; panelOpen: boolean };

/** Turn ?q=&scope=&sort=&owner=&tag=&... into a validated ArtifactQuery. */
export function parseArtifactParams(sp: RawParams, defaults: Partial<ArtifactQuery> = {}): ParsedQuery {
  const scope = one(sp.scope) as Scope;
  const sort = one(sp.sort) as Sort;
  const visibility = one(sp.visibility);
  const preview = one(sp.preview);
  return {
    ...defaults,
    q: one(sp.q).trim().slice(0, 200),
    scope: SCOPES.includes(scope) ? scope : (defaults.scope ?? "all"),
    sort: SORTS.includes(sort) ? sort : defaults.sort,
    owner: one(sp.owner).trim().toLowerCase() || undefined,
    tags: many(sp.tag).map((t) => t.toLowerCase()).slice(0, 10),
    visibility: visibility === "private" || visibility === "domain" || visibility === "restricted" ? visibility : undefined,
    updatedWithinDays: num(one(sp.updated), WITHIN_OPTIONS.map((o) => o.value)),
    createdWithinDays: num(one(sp.created), WITHIN_OPTIONS.map((o) => o.value)),
    preview: preview === "ready" || preview === "missing" ? preview : undefined,
    minViews: num(one(sp.views), VIEWS_OPTIONS.map((o) => o.value)),
    panelOpen: one(sp.fx) === "1",
  };
}

/** Serialise a query back into URL params (used for "remove this filter" links). */
export function toSearchParams(p: ParsedQuery, extra: Record<string, string> = {}): URLSearchParams {
  const sp = new URLSearchParams(extra);
  if (p.q) sp.set("q", p.q);
  if (p.scope && p.scope !== "all") sp.set("scope", p.scope);
  if (p.sort) sp.set("sort", p.sort);
  if (p.owner) sp.set("owner", p.owner);
  for (const t of p.tags) sp.append("tag", t);
  if (p.visibility) sp.set("visibility", p.visibility);
  if (p.updatedWithinDays) sp.set("updated", String(p.updatedWithinDays));
  if (p.createdWithinDays) sp.set("created", String(p.createdWithinDays));
  if (p.preview) sp.set("preview", p.preview);
  if (p.minViews) sp.set("views", String(p.minViews));
  if (p.panelOpen) sp.set("fx", "1");
  return sp;
}

/** Which filters are active (for the "Clear" affordance and summary). */
export function activeFilterCount(p: ParsedQuery, ignoreScope = false): number {
  let n = 0;
  if (!ignoreScope && p.scope !== "all") n++;
  if (p.owner) n++;
  n += p.tags.length;
  if (p.visibility) n++;
  if (p.updatedWithinDays) n++;
  if (p.createdWithinDays) n++;
  if (p.preview) n++;
  if (p.minViews) n++;
  return n;
}
