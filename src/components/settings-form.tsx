"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteArtifactForeverAction,
  restoreArtifactAction,
  trashArtifactAction,
  updateArtifact,
} from "@/actions/artifacts";
import { ChipsInput } from "@/components/chips";
import { DownloadLink } from "@/components/download-link";
import { Spinner } from "@/components/upload-form";
import { VisibilityPicker, type Visibility } from "@/components/visibility-picker";
import type { ArtifactDetail } from "@/lib/artifacts";
import { formatBytes, timeAgo } from "@/lib/format";
import { slugify } from "@/lib/slug";

type Msg = { kind: "ok" | "error"; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>;
}

export function SettingsForm({
  artifact,
  domain,
  maxBytes,
  origin,
  retentionDays,
  reports,
}: {
  artifact: ArtifactDetail;
  domain: string;
  maxBytes: number;
  origin: string;
  retentionDays: number;
  /** The owner's direct reports (empty when the owner isn't a manager). */
  reports: { email: string; name: string | null; title: string | null }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(artifact.title);
  const [slug, setSlug] = useState(artifact.slug);
  const [description, setDescription] = useState(artifact.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(artifact.sourceUrl ?? "");
  const [tags, setTags] = useState<string[]>(artifact.tags);
  const [visibility, setVisibility] = useState<Visibility>(artifact.visibility);
  const [shares, setShares] = useState<string[]>(artifact.shares);
  const [shareWithReports, setShareWithReports] = useState(artifact.shareWithReports);
  const [saving, startSave] = useTransition();
  const [message, setMessage] = useState<Msg>(null);

  const slugPreview = slugify(slug) || artifact.slug;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (visibility === "restricted" && shares.length === 0 && !shareWithReports) {
      setMessage({ kind: "error", text: "Add at least one person or your direct reports, or pick another option." });
      return;
    }
    setMessage(null);
    startSave(async () => {
      const res = await updateArtifact(artifact.id, {
        title,
        slug: slugPreview !== artifact.slug ? slugPreview : undefined,
        description,
        sourceUrl,
        tags,
        visibility,
        shares,
        shareWithReports,
      });
      if (res.ok) {
        setMessage({ kind: "ok", text: "Saved." });
        if (res.slug && res.slug !== artifact.slug) router.replace(`/a/${res.slug}/settings`);
        else router.refresh();
      } else {
        setMessage({ kind: "error", text: res.error });
      }
    });
  }

  return (
    <div className="space-y-8">
      {artifact.trashedAt ? <TrashedBanner artifact={artifact} retentionDays={retentionDays} /> : null}

      <form onSubmit={save} className="card space-y-6 p-5">
        <div>
          <label htmlFor="title" className="label">
            Name
          </label>
          <input id="title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="slug" className="label">
            Link
          </label>
          <div className="flex items-center overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
            <span className="shrink-0 border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              {origin.replace(/^https?:\/\//, "")}/a/
            </span>
            <input
              id="slug"
              className="w-full px-3 py-2 text-sm outline-none"
              value={slug}
              maxLength={80}
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug(slugify(slug) || artifact.slug)}
            />
          </div>
          <p className="help">
            {slugPreview !== artifact.slug ? (
              <>
                Will become <span className="font-mono">/a/{slugPreview}</span>. The old link keeps working.
              </>
            ) : (
              "Letters, numbers and dashes. Old links keep working after a change."
            )}
          </p>
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            className="input min-h-[72px] resize-y"
            value={description}
            maxLength={1000}
            placeholder="What is this, and what should people look at?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="sourceUrl" className="label">
              Source link
            </label>
            <input
              id="sourceUrl"
              type="url"
              className="input"
              value={sourceUrl}
              placeholder="https://claude.ai/chat/…"
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Tags</label>
            <ChipsInput value={tags} onChange={setTags} placeholder="sales, q3, renewals" />
          </div>
        </div>

        <VisibilityPicker
          visibility={visibility}
          onVisibilityChange={setVisibility}
          shares={shares}
          onSharesChange={setShares}
          domain={domain}
          reports={reports}
          shareWithReports={shareWithReports}
          onShareWithReportsChange={setShareWithReports}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : null} Save changes
          </button>
          <Message msg={message} />
        </div>
      </form>

      <ReplaceFile artifact={artifact} maxBytes={maxBytes} />
      <PreviewSection artifact={artifact} />
      <Stats artifact={artifact} />
      <DangerZone artifact={artifact} retentionDays={retentionDays} />
    </div>
  );
}

function TrashedBanner({ artifact, retentionDays }: { artifact: ArtifactDetail; retentionDays: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        <strong>This artifact is in the trash</strong> (since {artifact.trashedAt ? timeAgo(artifact.trashedAt) : ""}). Only
        you{artifact.isOwner ? "" : " and the owner"} can see it, and it will be deleted permanently {retentionDays} days after
        it was trashed.
      </p>
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await restoreArtifactAction(artifact.id);
            router.refresh();
          })
        }
      >
        {pending ? <Spinner /> : null} Restore
      </button>
    </div>
  );
}

function ReplaceFile({ artifact, maxBytes }: { artifact: ArtifactDetail; maxBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > maxBytes) {
      setMsg({ kind: "error", text: `That file is ${formatBytes(f.size)}; the limit is ${formatBytes(maxBytes)}.` });
      return;
    }
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", f);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}`, { method: "PUT", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; screenshotOk?: boolean };
      if (!res.ok) setMsg({ kind: "error", text: data.error ?? `Upload failed (${res.status})` });
      else {
        setMsg({
          kind: "ok",
          text: data.screenshotOk ? "File replaced and preview updated." : "File replaced; preview generation failed.",
        });
        router.refresh();
      }
    } catch {
      setMsg({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Replace the HTML</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Upload a newer export from Claude. The link stays the same, and the preview is regenerated. Current file:{" "}
        {formatBytes(artifact.htmlBytes)}.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input ref={input} type="file" accept=".html,.htm,text/html" className="sr-only" onChange={onChange} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Spinner /> : null} Choose new file…
        </button>
        <DownloadLink artifact={artifact} className="btn-ghost">
          Download current file
        </DownloadLink>
        <Message msg={msg} />
      </div>
    </section>
  );
}

function PreviewSection({ artifact }: { artifact: ArtifactDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [version, setVersion] = useState(artifact.updatedAt.getTime());

  async function regenerate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/screenshot`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMsg({ kind: "error", text: data.error ?? `Failed (${res.status})` });
      else {
        setMsg({ kind: "ok", text: "Preview regenerated." });
        setVersion(Date.now());
        router.refresh();
      }
    } catch {
      setMsg({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Dashboard preview</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 sm:w-64">
          {artifact.screenshotStatus === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/artifacts/${artifact.id}/screenshot?v=${version}`} alt="Current preview" className="size-full object-cover object-top" />
          ) : (
            <div className="grid size-full place-items-center text-xs text-neutral-400">
              {artifact.screenshotStatus === "pending" ? "Not generated yet" : "Generation failed"}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-neutral-600">
            A screenshot of the first screen of the artifact, taken when it was uploaded. Regenerate it if the page needed
            more time to render.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-secondary" disabled={busy} onClick={regenerate}>
              {busy ? <Spinner /> : null} Regenerate preview
            </button>
            <Message msg={msg} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats({ artifact }: { artifact: ArtifactDetail }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Activity</h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Views</dt>
          <dd className="mt-0.5 text-lg font-semibold text-neutral-900">{artifact.viewCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Last viewed</dt>
          <dd className="mt-0.5 text-neutral-900">{artifact.lastViewedAt ? timeAgo(artifact.lastViewedAt) : "never"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Shared with</dt>
          <dd className="mt-0.5 text-neutral-900">
            {artifact.visibility === "private"
              ? artifact.isOwner ? "only you" : "only the owner"
              : artifact.visibility === "domain"
                ? "everyone"
                : [
                    artifact.shares.length ? `${artifact.shares.length} ${artifact.shares.length === 1 ? "person" : "people"}` : null,
                    artifact.shareWithReports ? "direct reports" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ") || "nobody yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Uploaded</dt>
          <dd className="mt-0.5 text-neutral-900">{timeAgo(artifact.createdAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function DangerZone({ artifact, retentionDays }: { artifact: ArtifactDetail; retentionDays: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!artifact.trashedAt) {
    return (
      <section className="card border-amber-200 p-5">
        <h2 className="text-sm font-semibold text-amber-900">Move to trash</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Hides it from everyone but you. You can restore it from the Trash tab on your dashboard for {retentionDays}{" "}
          days; after that it&apos;s deleted permanently.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await trashArtifactAction(artifact.id);
                if (!r.ok) setError(r.error);
                else router.push("/?tab=trash");
              })
            }
          >
            {pending ? <Spinner /> : null} Move to trash
          </button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="card border-red-200 p-5">
      <h2 className="text-sm font-semibold text-red-800">Delete permanently</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Removes the file, its preview, every share and its view history right now. This can&apos;t be undone.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {confirming ? (
          <>
            <button
              type="button"
              className="btn border-red-600 bg-red-600 text-white hover:bg-red-700"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteArtifactForeverAction(artifact.id, "/?tab=trash");
                  if (res && !res.ok) setError(res.error);
                })
              }
            >
              {pending ? <Spinner /> : null} Yes, delete “{artifact.title}”
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Delete permanently…
          </button>
        )}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </section>
  );
}
