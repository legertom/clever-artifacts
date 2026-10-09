"use client";

import { useEffect, useRef, useState } from "react";

/** Clipboard API first; the legacy copy command where that's blocked. Never throws. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

type State = "idle" | "copied" | "failed";

/** Copies `url` to the clipboard and confirms for a moment. */
export function CopyLinkButton({ url, className = "" }: { url: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const ok = await copyText(url);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), ok ? 1800 : 3000);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy link";
  return (
    <button
      type="button"
      onClick={copy}
      title={state === "failed" ? `Copy this by hand: ${url}` : "Copy link to share"}
      aria-label="Copy link to share"
      aria-live="polite"
      className={`btn-ghost px-2.5 py-1.5 ${state === "copied" ? "text-emerald-700" : state === "failed" ? "text-red-700" : ""} ${className}`}
    >
      {state === "copied" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M10 13.5a4 4 0 005.7.3l2.6-2.6a4 4 0 00-5.7-5.7L11.3 6.8M14 10.5a4 4 0 00-5.7-.3l-2.6 2.6a4 4 0 005.7 5.7l1.3-1.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
