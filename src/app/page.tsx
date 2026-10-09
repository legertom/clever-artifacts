import Link from "next/link";
import { ArtifactCard } from "@/components/artifact-card";
import { FilterBar } from "@/components/filter-bar";
import { Nav } from "@/components/nav";
import { SearchForm } from "@/components/search-form";
import { TrashList } from "@/components/trash-list";
import { artifactFacets, listMine, listSharedWithMe, listTrash, purgeExpiredTrash, queryArtifacts } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN, TRASH_RETENTION_DAYS } from "@/lib/config";
import { activeFilterCount, parseArtifactParams, type RawParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

type SearchParams = Promise<RawParams>;
type Tab = "mine" | "shared" | "trash";

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "shared" ? "shared" : sp.tab === "trash" ? "trash" : "mine";

  // Belt and braces alongside the daily cron: expire old trash whenever someone looks.
  await purgeExpiredTrash().catch((e) => console.error("[trash]", e));

  const params = parseArtifactParams({ ...sp, q: undefined, scope: tab === "shared" ? "others" : "mine" });
  const filtering = activeFilterCount(params, true) > 0 || Boolean(params.sort);

  const [mine, shared, trash, facets, filtered] = await Promise.all([
    listMine(user),
    listSharedWithMe(user),
    listTrash(user),
    artifactFacets(user),
    tab === "trash" ? Promise.resolve([]) : queryArtifacts(user, { ...params, limit: 200 }),
  ]);
  const base = tab === "mine" ? mine : shared;
  const items = filtering ? filtered : base;

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Artifacts</h1>
            <p className="mt-1 text-sm text-neutral-500">Static copies of Claude artifacts. Nothing re-runs when they load.</p>
          </div>
          <Link href="/upload" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Upload artifact
          </Link>
        </div>

        <SearchForm className="mt-6 max-w-xl" />

        <div className="mt-5 flex gap-1 border-b border-neutral-200">
          <TabLink href="/" active={tab === "mine"} label="My artifacts" count={mine.length} />
          <TabLink href="/?tab=shared" active={tab === "shared"} label="Shared with me" count={shared.length} />
          <TabLink href="/?tab=trash" active={tab === "trash"} label={user.isAdmin ? "Trash (all)" : "Trash"} count={trash.length} />
        </div>

        {tab === "trash" ? (
          <TrashList items={trash} retentionDays={TRASH_RETENTION_DAYS} showOwner={user.isAdmin} />
        ) : base.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <>
            <div className="mt-5">
              <FilterBar
                value={params}
                facets={facets}
                action="/"
                hidden={tab === "shared" ? { tab: "shared" } : {}}
                showScope={false}
                showSearch={false}
                showVisibility={tab === "mine"}
                domain={ALLOWED_EMAIL_DOMAIN}
                clearHref={tab === "shared" ? "/?tab=shared" : "/"}
                activeCount={activeFilterCount(params, true)}
              />
            </div>
            {items.length === 0 ? (
              <p className="mt-8 text-sm text-neutral-500">Nothing matches these filters.</p>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <ArtifactCard key={a.id} artifact={a} showOwner={tab === "shared"} domain={ALLOWED_EMAIL_DOMAIN} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] leading-4 ${active ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-600"}`}>
        {count}
      </span>
    </Link>
  );
}

function EmptyState({ tab }: { tab: "mine" | "shared" }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h18M8 4v16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {tab === "mine" ? (
        <>
          <h2 className="mt-4 text-base font-semibold text-neutral-900">No artifacts yet</h2>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            Download an artifact from Claude as HTML, then upload it here to share a fixed snapshot.
          </p>
          <Link href="/upload" className="btn-primary mt-5">
            Upload your first artifact
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-base font-semibold text-neutral-900">Nothing shared with you yet</h2>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            Artifacts that teammates make visible to everyone, or share with you directly, show up here.
          </p>
        </>
      )}
    </div>
  );
}
