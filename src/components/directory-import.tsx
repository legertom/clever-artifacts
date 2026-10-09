"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Spinner } from "@/components/upload-form";

export function DirectoryImport({ domain }: { domain: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", f);
    try {
      const res = await fetch("/api/admin/people/import", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        parsed?: number;
        inserted?: number;
        updated?: number;
        skipped?: number;
      };
      if (!res.ok) setMsg({ kind: "error", text: data.error ?? `Import failed (${res.status})` });
      else {
        setMsg({
          kind: "ok",
          text: `Imported ${data.parsed} people: ${data.inserted} new, ${data.updated} updated` +
            (data.skipped ? `, ${data.skipped} skipped (not @${domain} or duplicates)` : "") + ".",
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
    <div className="flex flex-wrap items-center gap-3">
      <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" onChange={onChange} />
      <button type="button" className="btn-secondary px-3 py-1.5" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner /> : null} Import directory (.csv / .xlsx)
      </button>
      {msg ? <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
    </div>
  );
}
