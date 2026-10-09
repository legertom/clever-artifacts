export function VisibilityBadge({
  visibility,
  sharedDirectly,
  domain,
}: {
  visibility: "domain" | "restricted";
  sharedDirectly?: boolean;
  domain: string;
}) {
  if (sharedDirectly) {
    return (
      <span className="badge border-emerald-200 bg-emerald-50 text-emerald-800">
        <Dot className="bg-emerald-500" /> Shared with you
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
