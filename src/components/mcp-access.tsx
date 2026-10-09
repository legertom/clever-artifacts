"use client";

import { useState, useTransition } from "react";
import { createTokenAction, disconnectAppAction, revokeTokenAction } from "@/actions/mcp";
import { Spinner } from "@/components/upload-form";
import { timeAgo } from "@/lib/format";
import type { ConnectedAppRow, PersonalTokenRow } from "@/lib/oauth";

export function PersonalTokens({ tokens }: { tokens: PersonalTokenRow[] }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Personal tokens</h2>
      <p className="mt-1 text-sm text-neutral-600">
        For clients that can&apos;t do the OAuth sign-in (scripts, CI, or Claude Code with a fixed header). A token acts as
        you with the same permissions, so treat it like a password.
      </p>

      {fresh ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">Copy this token now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 font-mono text-xs text-neutral-900">
              {fresh}
            </code>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              onClick={() => {
                void navigator.clipboard.writeText(fresh).then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setFresh(null);
          setCopied(false);
          start(async () => {
            const r = await createTokenAction(name || "Personal token");
            if (r.ok) {
              setFresh(r.token);
              setName("");
            } else setError(r.error);
          });
        }}
      >
        <div className="min-w-[220px] flex-1">
          <label htmlFor="tokenName" className="label">
            Label
          </label>
          <input id="tokenName" className="input" value={name} maxLength={80} placeholder="e.g. Claude Code on my laptop" onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? <Spinner /> : null} Create token
        </button>
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </form>

      {tokens.length ? (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {tokens.map((t) => (
            <TokenRow key={t.tokenHash} token={t} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TokenRow({ token }: { token: PersonalTokenRow }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <div>
        <div className="font-medium text-neutral-900">{token.name ?? "Personal token"}</div>
        <div className="text-xs text-neutral-500">
          created {timeAgo(token.createdAt)} · {token.lastUsedAt ? `last used ${timeAgo(token.lastUsedAt)}` : "never used"}
        </div>
      </div>
      <button
        type="button"
        className="btn-danger px-3 py-1.5"
        disabled={pending}
        onClick={() => start(() => revokeTokenAction(token.tokenHash))}
      >
        {pending ? <Spinner /> : null} Revoke
      </button>
    </li>
  );
}

export function ConnectedApps({ apps }: { apps: ConnectedAppRow[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Connected apps</h2>
      <p className="mt-1 text-sm text-neutral-600">Clients you&apos;ve approved through the OAuth sign-in screen.</p>
      {apps.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nothing connected yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {apps.map((a) => (
            <AppRow key={a.clientId} app={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AppRow({ app }: { app: ConnectedAppRow }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-neutral-900">{app.clientName}</div>
        <div className="text-xs text-neutral-500">
          connected {timeAgo(app.since)} · {app.lastUsedAt ? `last used ${timeAgo(app.lastUsedAt)}` : "not used yet"}
        </div>
      </div>
      <button
        type="button"
        className="btn-danger px-3 py-1.5"
        disabled={pending}
        onClick={() => start(() => disconnectAppAction(app.clientId))}
      >
        {pending ? <Spinner /> : null} Disconnect
      </button>
    </li>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-900">
          {value}
        </code>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
