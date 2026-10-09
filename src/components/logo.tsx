import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-neutral-900">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden>
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 8.5h12M7.5 4v12" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Clever Artifacts</span>
    </Link>
  );
}
