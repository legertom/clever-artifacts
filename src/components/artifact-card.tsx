import Link from "next/link";
import { CardActions } from "@/components/artifact-actions";
import { Avatar } from "@/components/avatar";
import { VisibilityBadge } from "@/components/visibility-badge";
import type { ArtifactSummary } from "@/lib/artifacts";
import { timeAgo } from "@/lib/format";
import type { SessionUser } from "@/lib/session";

export function ArtifactCard({
  artifact,
  showOwner,
  domain,
  viewer,
  retentionDays,
}: {
  artifact: ArtifactSummary;
  showOwner: boolean;
  domain: string;
  /** Who is looking: their own artifacts are labelled "Yours", and owners (or admins) get the trash button. */
  viewer: Pick<SessionUser, "id" | "isAdmin">;
  retentionDays: number;
}) {
  const a = artifact;
  const isMine = a.ownerId === viewer.id;
  const previewSrc = `/api/artifacts/${a.id}/screenshot?v=${a.updatedAt.getTime()}`;
  return (
    <div className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-500/50">
      <Link href={`/a/${a.slug}`} className="flex flex-1 flex-col focus-visible:outline-none">
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
              <span className="text-xs">{a.screenshotStatus === "pending" ? "Preview coming soon" : "No preview"}</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">{a.title}</h3>
            {a.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{a.description}</p>
            ) : null}
          </div>
          {a.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {a.tags.slice(0, 5).map((t) => (
                <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                  #{t}
                </span>
              ))}
              {a.tags.length > 5 ? <span className="text-[11px] text-neutral-400">+{a.tags.length - 5}</span> : null}
            </div>
          ) : null}
          {/* Wraps so the visibility badge drops to its own line instead of breaking mid-text on narrow cards. */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-1">
            <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
              {showOwner && isMine ? (
                <>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Yours</span>
                  <span aria-hidden>·</span>
                </>
              ) : showOwner ? (
                <>
                  <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={18} />
                  <span className="truncate">{a.ownerName ?? a.ownerEmail}</span>
                  <span aria-hidden>·</span>
                </>
              ) : null}
              <span className="shrink-0">{timeAgo(a.updatedAt)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex shrink-0 items-center gap-1" title={`${a.viewCount} views`}>
                <EyeIcon /> {a.viewCount}
              </span>
            </div>
            <VisibilityBadge visibility={a.visibility} sharedDirectly={a.sharedDirectly} sharedViaReports={a.sharedViaReports} domain={domain} />
          </div>
        </div>
      </Link>
      <CardActions
        artifact={{ id: a.id, title: a.title, favorited: a.favorited }}
        canTrash={isMine || viewer.isAdmin}
        retentionDays={retentionDays}
      />
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
