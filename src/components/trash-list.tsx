"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteArtifactForeverAction, restoreArtifactAction } from "@/actions/artifacts";
import { Avatar } from "@/components/avatar";
import { DownloadLink } from "@/components/download-link";
import { Spinner } from "@/components/upload-form";
import { purgeDate, type ArtifactSummary } from "@/lib/artifacts";
import { formatBytes, timeAgo } from "@/lib/format";

function daysLeft(trashedAt: Date): number {
  return Math.max(0, Math.ceil((purgeDate(trashedAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function TrashList({
  items,
  retentionDays,
  showOwner,
}: {
  items: ArtifactSummary[];
  retentionDays: number;
  showOwner: boolean;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden>
          <path d="M12 9v4m0 4h.01M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>
          <strong>Anything in the trash for {retentionDays} days is deleted permanently</strong>, including its share
          list and view history. Restore anything you want to keep.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">The trash is empty.</p>
      ) : (
        <ul className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {items.map((a) => (
            <TrashRow key={a.id} artifact={a} showOwner={showOwner} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrashRow({ artifact: a, showOwner }: { artifact: ArtifactSummary; showOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = a.trashedAt ? daysLeft(a.trashedAt) : 0;

  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="h-12 w-20 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
        {a.screenshotStatus === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/artifacts/${a.id}/screenshot?v=${a.updatedAt.getTime()}`} alt="" className="size-full object-cover object-top" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/a/${a.slug}`} className="block truncate text-sm font-medium text-neutral-900 hover:underline">
          {a.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
          {showOwner ? (
            <span className="inline-flex items-center gap-1">
              <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={14} />
              {a.ownerName ?? a.ownerEmail}
            </span>
          ) : null}
          <span>{formatBytes(a.htmlBytes)}</span>
          {a.trashedAt ? <span>trashed {timeAgo(a.trashedAt)}</span> : null}
          <span className={left <= 3 ? "font-medium text-red-700" : "text-amber-800"}>
            {left === 0 ? "deletes today" : `deletes in ${left} day${left === 1 ? "" : "s"}`}
          </span>
        </div>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <DownloadLink artifact={a} className="btn-ghost px-3 py-1.5">
          Download
        </DownloadLink>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await restoreArtifactAction(a.id);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })
          }
        >
          Restore
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn border-red-600 bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteArtifactForeverAction(a.id);
                  if (r && !r.ok) setError(r.error);
                  else router.refresh();
                })
              }
            >
              {pending ? <Spinner /> : null} Delete now
            </button>
            <button type="button" className="btn-ghost px-2 py-1.5" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn-danger px-3 py-1.5" disabled={pending} onClick={() => setConfirming(true)}>
            Delete now
          </button>
        )}
      </div>
    </li>
  );
}
