import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { SettingsForm } from "@/components/settings-form";
import { getArtifactForViewer } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN, MAX_HTML_BYTES } from "@/lib/config";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Share & settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const a = await getArtifactForViewer(id, user);
  if (!a || !a.isOwner) notFound();

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Link href={`/a/${a.id}`} className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to artifact
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Share &amp; settings</h1>
        <p className="mt-1 truncate text-sm text-neutral-500">{a.title}</p>
        <div className="mt-6">
          <SettingsForm artifact={a} domain={ALLOWED_EMAIL_DOMAIN} maxBytes={MAX_HTML_BYTES} />
        </div>
      </main>
    </>
  );
}
