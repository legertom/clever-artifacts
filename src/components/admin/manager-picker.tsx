"use client";

import { useId, useState, useTransition } from "react";
import { setManagerAction } from "@/actions/admin";
import { SuggestionList, usePeopleSuggestions } from "@/components/people-suggest";

/** Inline "reports to" editor: pick anyone from the directory, or clear. */
export function ManagerPicker({
  userId,
  current,
  currentName,
}: {
  userId: string;
  current: string | null;
  currentName: string | null;
}) {
  const listId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(0);
  const [value, setValue] = useState<{ email: string | null; name: string | null }>({ email: current, name: currentName });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const suggestions = usePeopleSuggestions(draft, { includeSelf: true, enabled: editing });

  function commit(email: string | null) {
    setError(null);
    start(async () => {
      const res = await setManagerAction(userId, email);
      if (res.ok) {
        setValue({ email, name: res.managerName });
        setEditing(false);
      } else setError(res.error);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setActive(0);
          setEditing(true);
        }}
        className="group inline-flex max-w-[220px] items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm hover:bg-neutral-100"
        title="Change manager"
      >
        {value.email ? (
          <span className="min-w-0">
            <span className="block truncate text-neutral-900">{value.name ?? value.email}</span>
            {value.name ? <span className="block truncate text-[11px] text-neutral-500">{value.email}</span> : null}
          </span>
        ) : (
          <span className="text-neutral-400">No manager</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-400 opacity-0 transition group-hover:opacity-100" aria-hidden>
          <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative w-[260px]">
      <input
        value={draft}
        autoFocus
        disabled={pending}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(0);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length) {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && suggestions.length) {
            e.preventDefault();
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = suggestions[active]?.email ?? draft.trim();
            if (chosen) commit(chosen);
          } else if (e.key === "Escape") setEditing(false);
        }}
        placeholder={value.email ? `Currently ${value.name ?? value.email}` : "Type a name…"}
        className="input h-8 py-0 text-xs"
        autoComplete="off"
        spellCheck={false}
      />
      <SuggestionList
        id={listId}
        people={suggestions}
        activeIndex={active}
        onHover={setActive}
        onPick={(p) => commit(p.email)}
        emptyText={draft.trim() ? "No one matches." : undefined}
      />
      <div className="mt-1 flex items-center gap-1 text-[11px]">
        {value.email ? (
          <button type="button" className="text-red-700 hover:underline" disabled={pending} onMouseDown={(e) => e.preventDefault()} onClick={() => commit(null)}>
            Remove manager
          </button>
        ) : null}
        <span className="text-neutral-400">· Esc to cancel</span>
        {error ? <span className="text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}
