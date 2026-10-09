"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { email: string; name: string | null; image: string | null };

/**
 * Multi-email input. Emits the current list via `onChange`; the parent owns the
 * state. Suggestions come from people who have signed in before.
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = draft.trim();
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/users?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d: { users: Suggestion[] }) => setSuggestions(d.users ?? []))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft]);

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

  function commitDraft() {
    const parts = draft.split(/[\s,;]+/).filter(Boolean);
    let ok = true;
    for (const p of parts) ok = add(p) && ok;
    if (ok) setDraft("");
  }

  function remove(email: string) {
    onChange(value.filter((v) => v !== email));
    inputRef.current?.focus();
  }

  return (
    <div>
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
              onClick={() => remove(email)}
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
          list={listId}
          value={draft}
          autoFocus={autoFocus}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                commitDraft();
              }
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && commitDraft()}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,;]/.test(text)) {
              e.preventDefault();
              const parts = text.split(/[\s,;]+/).filter(Boolean);
              let ok = true;
              for (const p of parts) ok = add(p) && ok;
              if (ok) setDraft("");
            }
          }}
          placeholder={value.length ? "" : (placeholder ?? `name@${domain}`)}
          className="min-w-[160px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 focus:ring-0"
          autoComplete="off"
          spellCheck={false}
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s.email))
            .map((s) => (
              <option key={s.email} value={s.email}>
                {s.name ?? undefined}
              </option>
            ))}
        </datalist>
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
