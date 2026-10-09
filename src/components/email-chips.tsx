"use client";

import { useId, useRef, useState } from "react";
import { SuggestionList, usePeopleSuggestions } from "@/components/people-suggest";

/**
 * Multi-email input with a people picker. Emits the current list via
 * `onChange`; the parent owns the state. Suggestions come from the directory
 * and everyone who has signed in.
 */
export function EmailChips({
  value,
  onChange,
  domain,
  placeholder,
  autoFocus,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  domain: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = usePeopleSuggestions(draft, { enabled: open }).filter((p) => !value.includes(p.email));

  function normalize(raw: string): string {
    let e = raw.trim().toLowerCase();
    if (e && !e.includes("@")) e = `${e}@${domain}`;
    return e;
  }

  function add(raw: string): boolean {
    const e = normalize(raw);
    if (!e) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError(`"${raw.trim()}" isn't an email address`);
      return false;
    }
    if (!e.endsWith(`@${domain}`)) {
      setError(`Only @${domain} addresses can be added`);
      return false;
    }
    setError(null);
    if (!value.includes(e)) onChange([...value, e]);
    return true;
  }

  function addMany(text: string) {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    let ok = true;
    for (const p of parts) ok = add(p) && ok;
    if (ok) setDraft("");
  }

  function pick(email: string) {
    if (!value.includes(email)) onChange([...value, email]);
    setDraft("");
    setError(null);
    setActive(0);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <div
        className="input flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100 py-0.5 pl-2 pr-1 text-xs text-neutral-800"
          >
            {email}
            <button
              type="button"
              onClick={() => {
                onChange(value.filter((v) => v !== email));
                inputRef.current?.focus();
              }}
              className="grid size-4 place-items-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
              aria-label={`Remove ${email}`}
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
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (draft.trim()) addMany(draft);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(0);
            setOpen(true);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && suggestions.length) {
              e.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
              if (open && suggestions[active] && (e.key !== "Tab" || draft.trim())) {
                e.preventDefault();
                pick(suggestions[active].email);
              } else if (draft.trim()) {
                e.preventDefault();
                addMany(draft);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,;]/.test(text)) {
              e.preventDefault();
              addMany(text);
            }
          }}
          placeholder={value.length ? "" : (placeholder ?? "Type a name or email")}
          className="min-w-[160px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 focus:ring-0"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {open ? (
        <SuggestionList
          id={listId}
          people={suggestions}
          activeIndex={active}
          onHover={setActive}
          onPick={(p) => pick(p.email)}
          emptyText={draft.trim() ? `No one matches “${draft.trim()}” — press Enter to add the address as typed.` : undefined}
        />
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
