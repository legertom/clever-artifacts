"use client";

import { useRef, useState } from "react";

/** Generic chip list input (used for tags). The parent owns the state. */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  max = 10,
  normalize = (s) => s.trim().toLowerCase(),
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  max?: number;
  normalize?: (raw: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addMany(raw: string) {
    const parts = raw.split(/[,\n]+/).map(normalize).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  }

  return (
    <div
      className="input flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 py-1.5"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100 py-0.5 pl-2 pr-1 text-xs text-neutral-800"
        >
          {item}
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== item))}
            className="grid size-4 place-items-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
            aria-label={`Remove ${item}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && draft.trim()) {
            e.preventDefault();
            addMany(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && addMany(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            addMany(text);
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 focus:ring-0"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
