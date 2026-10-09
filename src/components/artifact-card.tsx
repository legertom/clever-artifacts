import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { VisibilityBadge } from "@/components/visibility-badge";
import type { ArtifactSummary } from "@/lib/artifacts";
import { timeAgo } from "@/lib/format";

export function ArtifactCard({
  artifact,
  showOwner,
}: {
  artifact: ArtifactSummary;
  showOwner: boolean;
}) {
  const a = artifact;
  const previewSrc = `/api/artifacts/${a.id}/screenshot?v=${a.updatedAt.getTime()}`;
  return (
    <Link
      href={`/a/${a.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-neutral-200 bg-neutral-100">
        {a.screenshotStatus === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt=""
            loading="lazy"
            className="size-full object-cover object-top transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-neutral-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-xs">
              {a.screenshotStatus === "pending" ? "Preview coming soon" : "No preview"}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">{a.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
            {showOwner ? (
              <>
                <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={18} />
                <span className="truncate">{a.ownerName ?? a.ownerEmail}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span className="shrink-0">{timeAgo(a.updatedAt)}</span>
          </div>
          <VisibilityBadge visibility={a.visibility} sharedDirectly={a.sharedDirectly} />
        </div>
      </div>
    </Link>
  );
}
