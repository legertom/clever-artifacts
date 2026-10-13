import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/admin/pager";
import { AdminToolbar } from "@/components/admin/toolbar";
import { Avatar } from "@/components/avatar";
import { ADMIN_PAGE_SIZE, adminActivityPage } from "@/lib/admin";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Activity" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const DAYS = [
  { value: "", label: "All time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const daysRaw = one(sp.days);
  const days = DAYS.some((d) => d.value === daysRaw && d.value) ? Number(daysRaw) : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { rows, total } = await adminActivityPage({ q, days, page });

  return (
    <div className="space-y-4">
      <AdminToolbar
        action="/admin/activity"
        q={q}
        placeholder="Search by person or artifact"
        selects={[{ name: "days", label: "When", value: days ? String(days) : "", options: DAYS }]}
        summary={`${total.toLocaleString()} view${total === 1 ? "" : "s"}`}
      />
      <ul className="card divide-y divide-neutral-100">
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-neutral-500">No views match.</li>
        ) : (
          rows.map((v) => (
            <li key={v.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
              <Avatar name={v.viewerName} email={v.viewerEmail} image={v.viewerImage} size={20} />
              <span className="min-w-0 flex-1 truncate">
                <Link href={`/admin/activity?q=${encodeURIComponent(v.viewerEmail)}`} className="font-medium text-neutral-900 hover:underline">
                  {v.viewerName ?? v.viewerEmail}
                </Link>
                <span className="text-neutral-500"> opened </span>
                <Link href={`/a/${v.slug}`} className="text-neutral-800 hover:underline">
                  {v.title}
                </Link>
                {v.trashedAt ? <span className="ml-1.5 text-xs text-amber-700">(in trash)</span> : null}
              </span>
              <time className="shrink-0 text-xs text-neutral-400" dateTime={v.viewedAt.toISOString()} title={v.viewedAt.toLocaleString()}>
                {timeAgo(v.viewedAt)}
              </time>
            </li>
          ))
        )}
      </ul>
      <Pager page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/activity" params={{ q, days: days ? String(days) : undefined }} />
    </div>
  );
}
