import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { VisibilityBadge } from "@/components/visibility-badge";
import { getArtifactForViewer } from "@/lib/artifacts";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const a = await getArtifactForViewer(id, user);
  return { title: a?.title ?? "Not found" };
}

export default async function ArtifactPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const a = await getArtifactForViewer(id, user);
  if (!a) notFound();

  const rawUrl = `/a/${a.id}/raw`;

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
          <h1 className="truncate text-sm font-semibold text-neutral-900">{a.title}</h1>
          <VisibilityBadge visibility={a.visibility} sharedDirectly={a.sharedDirectly} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 text-xs text-neutral-500 md:flex">
            <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={20} />
            <span>{a.isOwner ? "You" : (a.ownerName ?? a.ownerEmail)}</span>
            <span aria-hidden>·</span>
            <span>updated {timeAgo(a.updatedAt)}</span>
          </div>
          <a href={rawUrl} target="_blank" rel="noopener" className="btn-secondary px-3 py-1.5">
            Open full screen
          </a>
          {a.isOwner ? (
            <Link href={`/a/${a.id}/settings`} className="btn-primary px-3 py-1.5">
              Share &amp; settings
            </Link>
          ) : null}
        </div>
      </header>
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
