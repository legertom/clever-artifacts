import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/admin/pager";
import { AdminToolbar } from "@/components/admin/toolbar";
import { Avatar } from "@/components/avatar";
import { ADMIN_ARTIFACT_SORTS, ADMIN_PAGE_SIZE, ARTIFACT_STATUS, adminArtifactsPage, type AdminArtifactSort, type ArtifactStatus } from "@/lib/admin";
import { purgeDate } from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { formatBytes, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Artifacts" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export default async function AdminArtifactsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const status = (ARTIFACT_STATUS as readonly string[]).includes(one(sp.status)) ? (one(sp.status) as ArtifactStatus) : "all";
  const sort = (one(sp.sort) in ADMIN_ARTIFACT_SORTS ? one(sp.sort) : "views") as AdminArtifactSort;
  const vis = one(sp.visibility);
  const visibility = vis === "private" || vis === "domain" || vis === "restricted" ? vis : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const { rows, total } = await adminArtifactsPage({ q, status, sort, visibility, page });
  const params = { q, status: status === "all" ? undefined : status, sort: sort === "views" ? undefined : sort, visibility };

  return (
    <div className="space-y-4">
      <AdminToolbar
        action="/admin/artifacts"
        q={q}
        placeholder="Search by name, link, tag or owner"
        selects={[
          { name: "status", label: "Status", value: status, options: [{ value: "all", label: "Active + trash" }, { value: "active", label: "Active" }, { value: "trash", label: "In trash" }] },
          {
            name: "visibility",
            label: "Access",
            value: visibility ?? "",
            options: [
              { value: "", label: "Any" },
              { value: "private", label: "Only owner" },
              { value: "restricted", label: "Specific people" },
              { value: "domain", label: `Everyone at ${ALLOWED_EMAIL_DOMAIN}` },
            ],
          },
          { name: "sort", label: "Sort", value: sort, options: Object.entries(ADMIN_ARTIFACT_SORTS).map(([value, label]) => ({ value, label })) },
        ]}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Artifact</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Access</th>
              <th className="px-3 py-2 text-right">Views</th>
              <th className="px-3 py-2 text-right">7d</th>
              <th className="px-3 py-2 text-right">Viewers</th>
              <th className="px-3 py-2">Last viewed</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-neutral-500">
                  Nothing matches.
                </td>
              </tr>
            ) : null}
            {rows.map((a) => (
              <tr key={a.id} className={a.trashedAt ? "bg-amber-50/40" : ""}>
                <td className="max-w-[280px] px-3 py-2">
                  <Link href={`/a/${a.slug}`} className="block truncate font-medium text-neutral-900 hover:underline">
                    {a.title}
                  </Link>
                  <span className="block truncate font-mono text-[11px] text-neutral-400">/a/{a.slug}</span>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/artifacts?q=${encodeURIComponent(a.ownerEmail)}`} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:underline">
                    <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={18} />
                    <span className="text-neutral-800">{a.ownerName ?? a.ownerEmail}</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                  {a.visibility === "private"
                    ? "owner only"
                    : a.visibility === "domain"
                      ? `everyone @${ALLOWED_EMAIL_DOMAIN}`
                      : [a.shareCount ? `${a.shareCount} ${a.shareCount === 1 ? "person" : "people"}` : null, a.shareWithReports ? "direct reports" : null]
                          .filter(Boolean)
                          .join(" + ") || "nobody"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{a.viewCount}</td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{a.views7d}</td>
                <td className="px-3 py-2 text-right tabular-nums">{a.uniqueViewers}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{a.lastViewedAt ? timeAgo(a.lastViewedAt) : "never"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatBytes(a.htmlBytes)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{timeAgo(a.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {a.trashedAt ? (
                    <span className="badge border-amber-200 bg-amber-50 text-amber-800">
                      trash · purges {purgeDate(a.trashedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  ) : a.screenshotStatus === "ready" ? (
                    <span className="badge border-emerald-200 bg-emerald-50 text-emerald-800">active</span>
                  ) : (
                    <span className="badge border-neutral-200 bg-neutral-50 text-neutral-700">no preview</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/a/${a.slug}/settings`} className="btn-ghost px-2 py-1 text-xs">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/artifacts" params={params} />
    </div>
  );
}
