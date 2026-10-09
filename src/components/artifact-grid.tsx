"use client";

import { useMemo, useState } from "react";
import { ArtifactCard } from "@/components/artifact-card";
import type { ArtifactSummary } from "@/lib/artifacts";

/** Card grid with a client-side search box over title, description, tags and owner. */
export function ArtifactGrid({
  items,
  showOwner,
  domain,
}: {
  items: ArtifactSummary[];
  showOwner: boolean;
  domain: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((a) =>
      [a.title, a.description ?? "", a.tags.map((t) => `#${t}`).join(" "), a.ownerName ?? "", a.ownerEmail]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [items, q]);

  return (
    <div className="mt-6">
      <div className="relative max-w-md">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, description, #tag or person"
          className="input pl-9"
          aria-label="Search artifacts"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">Nothing matches “{q}”.</p>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <ArtifactCard key={a.id} artifact={a} showOwner={showOwner} domain={domain} />
          ))}
        </div>
      )}
    </div>
  );
}
