"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteArtifact, updateArtifact } from "@/actions/artifacts";
import { Spinner } from "@/components/upload-form";
import { VisibilityPicker } from "@/components/visibility-picker";
import type { ArtifactDetail } from "@/lib/artifacts";
import { formatBytes } from "@/lib/format";

export function SettingsForm({
  artifact,
  domain,
  maxBytes,
}: {
  artifact: ArtifactDetail;
  domain: string;
  maxBytes: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(artifact.title);
  const [visibility, setVisibility] = useState(artifact.visibility);
  const [shares, setShares] = useState<string[]>(artifact.shares);
  const [saving, startSave] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (visibility === "restricted" && shares.length === 0) {
      setMessage({ kind: "error", text: "Add at least one person, or make it visible to everyone." });
      return;
    }
    setMessage(null);
    startSave(async () => {
      const res = await updateArtifact(artifact.id, { title, visibility, shares });
      if (res.ok) {
        setMessage({ kind: "ok", text: "Saved." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: res.error });
      }
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="card space-y-6 p-5">
        <div>
          <label htmlFor="title" className="label">
            Name
          </label>
          <input
            id="title"
            className="input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <VisibilityPicker
          visibility={visibility}
          onVisibilityChange={setVisibility}
          shares={shares}
          onSharesChange={setShares}
          domain={domain}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : null} Save changes
          </button>
          {message ? (
            <span className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>
              {message.text}
            </span>
          ) : null}
        </div>
      </form>

      <ReplaceFile artifact={artifact} maxBytes={maxBytes} />
      <PreviewSection artifact={artifact} />
      <DangerZone artifact={artifact} />
    </div>
  );
}

function ReplaceFile({ artifact, maxBytes }: { artifact: ArtifactDetail; maxBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

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
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error ?? `Upload failed (${res.status})` });
      } else {
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
        Upload a newer export from Claude. The link stays the same, and the preview is regenerated.
        Current file: {formatBytes(artifact.htmlBytes)}.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input ref={input} type="file" accept=".html,.htm,text/html" className="sr-only" onChange={onChange} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Spinner /> : null} Choose new file…
        </button>
        {msg ? (
          <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>
        ) : null}
      </div>
    </section>
  );
}

function PreviewSection({ artifact }: { artifact: ArtifactDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
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
            <img
              src={`/api/artifacts/${artifact.id}/screenshot?v=${version}`}
              alt="Current preview"
              className="size-full object-cover object-top"
            />
          ) : (
            <div className="grid size-full place-items-center text-xs text-neutral-400">
              {artifact.screenshotStatus === "pending" ? "Not generated yet" : "Generation failed"}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-neutral-600">
            A screenshot of the first screen of the artifact, taken when it was uploaded. Regenerate it if the
            page needed more time to render.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-secondary" disabled={busy} onClick={regenerate}>
              {busy ? <Spinner /> : null} Regenerate preview
            </button>
            {msg ? (
              <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DangerZone({ artifact }: { artifact: ArtifactDetail }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card border-red-200 p-5">
      <h2 className="text-sm font-semibold text-red-800">Delete this artifact</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Removes the file, its preview and every share. Anyone with the link will get a “not found” page.
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
                  const res = await deleteArtifact(artifact.id);
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
            Delete artifact…
          </button>
        )}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </section>
  );
}
