import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FavoriteButton } from "@/components/artifact-actions";
import { EyeIcon } from "@/components/artifact-card";
import { Avatar } from "@/components/avatar";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DownloadLink } from "@/components/download-link";
import { Logo } from "@/components/logo";
import { VisibilityBadge } from "@/components/visibility-badge";
import { getArtifactForViewer, purgeDate, resolveHandle } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { getOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await requireUser();
  const resolved = await resolveHandle((await params).id);
  const a = resolved ? await getArtifactForViewer(resolved.id, user) : null;
  return { title: a?.title ?? "Not found", description: a?.description ?? undefined };
}

export default async function ArtifactPage({ params }: Props) {
  const user = await requireUser();
  const handle = (await params).id;
  const resolved = await resolveHandle(handle);
  if (!resolved) notFound();
  if (!resolved.canonical) redirect(`/a/${resolved.slug}`);

  const a = await getArtifactForViewer(resolved.id, user);
  if (!a) notFound();

  const rawUrl = `/a/${a.slug}/raw`;
  const shareUrl = `${await getOrigin()}/a/${a.slug}`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="btn-ghost -ml-1 px-2 py-1 text-neutral-500" aria-label="Back to dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="hidden sm:block">
            <Logo />
          </div>
          <span className="hidden text-neutral-300 sm:inline">/</span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-neutral-900" title={a.description ?? undefined}>
              {a.title}
            </h1>
            {a.description ? (
              <p className="hidden truncate text-[11px] leading-3 text-neutral-500 lg:block">{a.description}</p>
            ) : null}
          </div>
          <VisibilityBadge visibility={a.visibility} sharedDirectly={a.sharedDirectly} sharedViaReports={a.sharedViaReports} domain={ALLOWED_EMAIL_DOMAIN} />
          {a.tags.length ? (
            <span className="hidden gap-1 xl:flex">
              {a.tags.slice(0, 4).map((t) => (
                <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                  #{t}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 text-xs text-neutral-500 md:flex">
            <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={20} />
            <span>{a.isOwner ? "You" : (a.ownerName ?? a.ownerEmail)}</span>
            <span aria-hidden>·</span>
            <span>updated {timeAgo(a.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" title="Views">
              <EyeIcon /> {a.viewCount}
            </span>
          </div>
          {!a.trashedAt ? <FavoriteButton artifact={{ id: a.id, favorited: a.favorited }} /> : null}
          <CopyLinkButton url={shareUrl} />
          <DownloadLink artifact={a} className="btn-ghost px-2.5 py-1.5">
            <span className="hidden sm:inline">Download</span>
          </DownloadLink>
          {a.sourceUrl ? (
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2.5 py-1.5" title={a.sourceUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M10 14L21 3m0 0h-6m6 0v6M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Source
            </a>
          ) : null}
          <a href={rawUrl} target="_blank" rel="noopener" className="btn-secondary px-3 py-1.5">
            Open full screen
          </a>
          {a.canEdit ? (
            <Link href={`/a/${a.slug}/settings`} className="btn-primary px-3 py-1.5">
              Share &amp; settings
            </Link>
          ) : null}
        </div>
      </header>
      {a.trashedAt ? (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            <strong>In the trash.</strong> Only {a.isOwner ? "you" : "the owner and admins"} can see this. It will be deleted
            permanently on {purgeDate(a.trashedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.
          </span>
          <Link href={`/a/${a.slug}/settings`} className="btn-secondary px-3 py-1">
            Restore
          </Link>
        </div>
      ) : null}
      <iframe
        src={rawUrl}
        title={a.title}
        className="min-h-0 w-full flex-1 bg-white"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
