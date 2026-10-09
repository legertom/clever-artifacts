import Link from "next/link";

/** "1–50 of 1,234" with Prev / Next links that keep the other query params. */
export function Pager({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const btn = "btn-secondary px-3 py-1.5 text-xs";
  const disabled = "btn-secondary px-3 py-1.5 text-xs opacity-50 pointer-events-none";
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
      <span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <Link href={href(page - 1)} className={page > 1 ? btn : disabled} aria-disabled={page <= 1}>
          ← Prev
        </Link>
        <span>
          Page {page} of {pages}
        </span>
        <Link href={href(page + 1)} className={page < pages ? btn : disabled} aria-disabled={page >= pages}>
          Next →
        </Link>
      </div>
    </div>
  );
}
