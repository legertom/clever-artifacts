export function SearchForm({
  defaultValue = "",
  size = "md",
  autoFocus,
  className = "",
}: {
  defaultValue?: string;
  size?: "sm" | "md";
  autoFocus?: boolean;
  className?: string;
}) {
  const compact = size === "sm";
  return (
    <form action="/search" method="get" role="search" className={`relative ${className}`}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={compact ? "Search artifacts" : "Search everything you can see: name, description, #tag or person"}
        aria-label="Search artifacts"
        autoComplete="off"
        className={`input pl-9 ${compact ? "py-1.5 text-[13px]" : ""}`}
      />
    </form>
  );
}
