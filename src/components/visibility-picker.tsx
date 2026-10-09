"use client";

import { EmailChips } from "@/components/email-chips";

export type Visibility = "private" | "domain" | "restricted";

export function VisibilityPicker({
  visibility,
  onVisibilityChange,
  shares,
  onSharesChange,
  domain,
  reports,
  shareWithReports,
  onShareWithReportsChange,
}: {
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  shares: string[];
  onSharesChange: (emails: string[]) => void;
  domain: string;
  /** The owner's direct reports from the directory; empty for non-managers. */
  reports?: { email: string; name: string | null; title: string | null }[];
  shareWithReports?: boolean;
  onShareWithReportsChange?: (on: boolean) => void;
}) {
  const reportsList = reports ?? [];
  return (
    <fieldset>
      <legend className="label">Who can view</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <Option
          checked={visibility === "private"}
          onSelect={() => onVisibilityChange("private")}
          title="Only me"
          description="Nobody else can open it, not even admins."
        />
        <Option
          checked={visibility === "restricted"}
          onSelect={() => onVisibilityChange("restricted")}
          title="Specific people"
          description="Only you and the people you list."
        />
        <Option
          checked={visibility === "domain"}
          onSelect={() => onVisibilityChange("domain")}
          title={`Everyone at ${domain}`}
          description="Anyone who signs in with a work account."
        />
      </div>
      {visibility !== "private" ? (
        <div className="mt-3">
          <label className="label">
            People
            <span className="ml-1.5 font-normal text-neutral-500">
              {visibility === "domain" ? "(optional — they'll see it under “Shared with me” either way)" : ""}
            </span>
          </label>
          <EmailChips value={shares} onChange={onSharesChange} domain={domain} />
          <p className="help">Type a name or address and press Enter. Paste a list to add several at once.</p>
          {visibility === "restricted" && reportsList.length === 0 && onShareWithReportsChange ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500">
              <span aria-hidden>👥</span>
              <span>
                <span className="font-medium text-neutral-700">My direct reports</span> appears here for managers. The
                directory doesn&apos;t list anyone reporting to you; an admin can fix that under Admin → People.
              </span>
            </p>
          ) : null}
          {visibility === "restricted" && reportsList.length > 0 && onShareWithReportsChange ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 bg-white p-3 transition hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={Boolean(shareWithReports)}
                onChange={(e) => onShareWithReportsChange(e.target.checked)}
                className="mt-0.5 accent-brand-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">
                  My direct reports
                  <span className="ml-1.5 font-normal text-neutral-500">({reportsList.length})</span>
                </span>
                <span className="block text-xs text-neutral-500">
                  Everyone who reports to you in the directory, kept up to date as the team changes:{" "}
                  {reportsList
                    .slice(0, 6)
                    .map((r) => r.name ?? r.email)
                    .join(", ")}
                  {reportsList.length > 6 ? ` and ${reportsList.length - 6} more` : ""}.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function Option({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
        checked ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/40" : "border-neutral-300 bg-white hover:bg-neutral-50"
      }`}
    >
      <input type="radio" name="visibility" checked={checked} onChange={onSelect} className="mt-0.5 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium text-neutral-900">{title}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </label>
  );
}
