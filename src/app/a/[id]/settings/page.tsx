import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { SettingsForm } from "@/components/settings-form";
import { getArtifactForViewer, resolveHandle } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN, MAX_HTML_BYTES, TRASH_RETENTION_DAYS } from "@/lib/config";
import { getOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Share & settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const resolved = await resolveHandle((await params).id);
  if (!resolved) notFound();
  if (!resolved.canonical) redirect(`/a/${resolved.slug}/settings`);

  const a = await getArtifactForViewer(resolved.id, user);
  if (!a || !a.canEdit) notFound();
  const origin = await getOrigin();

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Link href={`/a/${a.slug}`} className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to artifact
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Share &amp; settings</h1>
        <p className="mt-1 truncate text-sm text-neutral-500">
          {a.title}
          {!a.isOwner ? <span className="ml-2 badge border-violet-200 bg-violet-50 text-violet-800">editing as admin</span> : null}
        </p>
        <div className="mt-6">
          <SettingsForm
            artifact={a}
            domain={ALLOWED_EMAIL_DOMAIN}
            maxBytes={MAX_HTML_BYTES}
            origin={origin}
            retentionDays={TRASH_RETENTION_DAYS}
          />
        </div>
      </main>
    </>
  );
}
