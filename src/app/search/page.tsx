import type { Metadata } from "next";
import Link from "next/link";
import { ArtifactCard } from "@/components/artifact-card";
import { FilterBar } from "@/components/filter-bar";
import { Nav } from "@/components/nav";
import { artifactFacets, queryArtifacts } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { activeFilterCount, parseArtifactParams, type RawParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

type SearchParams = Promise<RawParams>;
const LIMIT = 120;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  return { title: query ? `“${query}” – Search` : "Search & browse" };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = parseArtifactParams(await searchParams);
  const [results, facets] = await Promise.all([queryArtifacts(user, { ...params, limit: LIMIT }), artifactFacets(user)]);
  const active = activeFilterCount(params);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Search &amp; browse</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Everything you can open: your artifacts, ones shared with you, and ones open to everyone at{" "}
          {ALLOWED_EMAIL_DOMAIN}. Use <span className="font-mono">#tag</span> in the search box to match a tag exactly.
        </p>

        <div className="mt-5">
          <FilterBar value={params} facets={facets} action="/search" domain={ALLOWED_EMAIL_DOMAIN} clearHref="/search" activeCount={active} />
        </div>

        {results.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-neutral-900">
              {params.q ? `No matches for “${params.q}”` : "Nothing matches these filters"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Try fewer words or filters. Private artifacts belonging to others never show up here.
            </p>
            <Link href="/search" className="btn-secondary mt-5">
              Clear everything
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-neutral-500">
              {results.length === LIMIT ? `First ${LIMIT} results` : `${results.length} result${results.length === 1 ? "" : "s"}`}
              {params.q ? ` for “${params.q}”` : ""}
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((a) => (
                <ArtifactCard key={a.id} artifact={a} showOwner domain={ALLOWED_EMAIL_DOMAIN} viewerId={user.id} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
