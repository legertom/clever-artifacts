"use client";

import { EmailChips } from "@/components/email-chips";

export function VisibilityPicker({
  visibility,
  onVisibilityChange,
  shares,
  onSharesChange,
  domain,
}: {
  visibility: "domain" | "restricted";
  onVisibilityChange: (v: "domain" | "restricted") => void;
  shares: string[];
  onSharesChange: (emails: string[]) => void;
  domain: string;
}) {
  return (
    <fieldset>
      <legend className="label">Who can view</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <Option
          checked={visibility === "domain"}
          onSelect={() => onVisibilityChange("domain")}
          title={`Everyone at ${domain}`}
          description="Anyone who signs in with a work Google account."
        />
        <Option
          checked={visibility === "restricted"}
          onSelect={() => onVisibilityChange("restricted")}
          title="Specific people"
          description="Only you and the people you list below."
        />
      </div>
      <div className="mt-3">
        <label className="label">
          People
          <span className="ml-1.5 font-normal text-neutral-500">
            {visibility === "domain" ? "(optional — they'll see it under “Shared with me” either way)" : ""}
          </span>
        </label>
        <EmailChips value={shares} onChange={onSharesChange} domain={domain} />
        <p className="help">Type a name or address and press Enter. Paste a list to add several at once.</p>
      </div>
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
