"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChipsInput } from "@/components/chips";
import { VisibilityPicker } from "@/components/visibility-picker";
import { formatBytes } from "@/lib/format";
import { extractTitle } from "@/lib/html";
import { slugify } from "@/lib/slug";

export function UploadForm({ domain, maxBytes, origin }: { domain: string; maxBytes: number; origin: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"domain" | "restricted">("domain");
  const [shares, setShares] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(f: File | null) {
    setError(null);
    if (!f) return;
    if (!/\.html?$/i.test(f.name) && f.type !== "text/html") {
      setError("Choose an .html file.");
      return;
    }
    if (f.size > maxBytes) {
      setError(`That file is ${formatBytes(f.size)}; the limit is ${formatBytes(maxBytes)}.`);
      return;
    }
    setFile(f);
    if (!titleTouched) {
      const text = await f.slice(0, 64 * 1024).text();
      setTitle(extractTitle(text) ?? f.name.replace(/\.html?$/i, ""));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose an HTML file to upload.");
      return;
    }
    if (visibility === "restricted" && shares.length === 0) {
      setError("Add at least one person, or make it visible to everyone.");
      return;
    }
    setStatus("uploading");
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", title.trim());
    fd.set("slug", slugPreview);
    fd.set("description", description.trim());
    fd.set("sourceUrl", sourceUrl.trim());
    fd.set("tags", tags.join(","));
    fd.set("visibility", visibility);
    fd.set("shares", shares.join(","));
    try {
      const res = await fetch("/api/artifacts", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!res.ok || !data.slug) {
        setError(data.error ?? `Upload failed (${res.status})`);
        setStatus("idle");
        return;
      }
      router.push(`/a/${data.slug}`);
    } catch {
      setError("Network error — check your connection and try again.");
      setStatus("idle");
    }
  }

  const busy = status === "uploading";
  const slugPreview = slugify(slugTouched ? slug : title);

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="label">HTML file</label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void pick(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-brand-500 bg-brand-50" : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".html,.htm,text/html"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <p className="text-sm font-medium text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-500">{formatBytes(file.size)} · click to choose a different file</p>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-neutral-400" aria-hidden>
                <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-neutral-700">
                <span className="font-medium text-brand-700">Choose a file</span> or drag it here
              </p>
              <p className="text-xs text-neutral-500">The .html you downloaded from Claude · up to {formatBytes(maxBytes)}</p>
            </>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="label">
          Name
        </label>
        <input
          id="title"
          className="input"
          value={title}
          maxLength={200}
          placeholder="e.g. Q3 district renewals dashboard"
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
        />
        <p className="help">Pulled from the file&apos;s title automatically.</p>
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
            value={slugTouched ? slug : slugPreview}
            maxLength={80}
            spellCheck={false}
            placeholder="my-artifact"
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            onBlur={() => slugTouched && setSlug(slugify(slug))}
          />
        </div>
        <p className="help">
          {slugPreview ? (
            <>
              Your artifact will live at <span className="font-mono">/a/{slugPreview}</span>. Spaces become dashes; if
              it&apos;s taken, a number is added.
            </>
          ) : (
            "Made from the name unless you type your own. Spaces become dashes."
          )}
        </p>
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description <span className="font-normal text-neutral-500">(optional)</span>
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
            Source link <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id="sourceUrl"
            type="url"
            className="input"
            value={sourceUrl}
            placeholder="https://claude.ai/chat/…"
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          <p className="help">The Claude conversation or doc this came from.</p>
        </div>
        <div>
          <label className="label">
            Tags <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <ChipsInput value={tags} onChange={setTags} placeholder="sales, q3, renewals" />
          <p className="help">Press Enter or comma after each tag.</p>
        </div>
      </div>

      <VisibilityPicker
        visibility={visibility}
        onVisibilityChange={setVisibility}
        shares={shares}
        onSharesChange={setShares}
        domain={domain}
      />

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !file}>
          {busy ? (
            <>
              <Spinner /> Uploading &amp; generating preview…
            </>
          ) : (
            "Upload artifact"
          )}
        </button>
        {busy ? <span className="text-xs text-neutral-500">This takes a few seconds.</span> : null}
      </div>
    </form>
  );
}

export function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
