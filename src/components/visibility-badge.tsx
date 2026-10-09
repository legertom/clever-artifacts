export function VisibilityBadge({
  visibility,
  sharedDirectly,
  sharedViaReports,
  domain,
}: {
  visibility: "private" | "domain" | "restricted";
  sharedDirectly?: boolean;
  sharedViaReports?: boolean;
  domain: string;
}) {
  if (visibility === "private") {
    return (
      <span className="badge border-neutral-300 bg-neutral-100 text-neutral-700">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.5" />
          <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2.5" />
        </svg>
        Only you
      </span>
    );
  }
  if (sharedDirectly) {
    return (
      <span className="badge border-emerald-200 bg-emerald-50 text-emerald-800">
        <Dot className="bg-emerald-500" /> {sharedViaReports ? "Shared with your team" : "Shared with you"}
      </span>
    );
  }
  if (visibility === "domain") {
    return (
      <span className="badge border-brand-200 bg-brand-50 text-brand-800">
        <Dot className="bg-brand-500" /> Everyone @{domain}
      </span>
    );
  }
  return (
    <span className="badge border-amber-200 bg-amber-50 text-amber-800">
      <Dot className="bg-amber-500" /> Specific people
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`size-1.5 rounded-full ${className}`} />;
}
