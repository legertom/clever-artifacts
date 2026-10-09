import Link from "next/link";
import { ArtifactCard } from "@/components/artifact-card";
import { Nav } from "@/components/nav";
import { listMine, listSharedWithMe } from "@/lib/artifacts";
import { requireUser } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "shared" ? "shared" : "mine";

  const [mine, shared] = await Promise.all([listMine(user), listSharedWithMe(user)]);
  const items = tab === "mine" ? mine : shared;

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Artifacts</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Static copies of Claude artifacts. Nothing re-runs when they load.
            </p>
          </div>
          <Link href="/upload" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Upload artifact
          </Link>
        </div>

        <div className="mt-6 flex gap-1 border-b border-neutral-200">
          <Tab href="/" active={tab === "mine"} label="My artifacts" count={mine.length} />
          <Tab href="/?tab=shared" active={tab === "shared"} label="Shared with me" count={shared.length} />
        </div>

        {items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <ArtifactCard key={a.id} artifact={a} showOwner={tab === "shared"} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[11px] leading-4 ${
          active ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-600"
        }`}
      >
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
