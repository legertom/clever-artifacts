import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { adminOverview, adminRecentViews, adminTopArtifacts, adminViewsPerDay } from "@/lib/admin";
import { formatBytes, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [overview, top, recent, perDay] = await Promise.all([
    adminOverview(),
    adminTopArtifacts(8),
    adminRecentViews(12),
    adminViewsPerDay(30),
  ]);
  const maxDay = Math.max(1, ...perDay.map((d) => d.views));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Artifacts" value={overview.artifactsActive} sub={`${overview.artifactsTrashed} in trash · ${formatBytes(overview.totalBytes)}`} href="/admin/artifacts" />
        <Tile label="People signed in" value={overview.users} sub={`${overview.activeUsers7d} active in 7 days · ${overview.usersTotal.toLocaleString()} in directory`} href="/admin/people" />
        <Tile label="Views" value={overview.views} sub={`${overview.views7d.toLocaleString()} last 7 days · ${overview.views30d.toLocaleString()} last 30`} href="/admin/activity" />
        <Tile label="Unique viewers" value={overview.uniqueViewers} sub="people who opened at least one artifact" href="/admin/activity" />
      </section>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Views per day</h2>
          <span className="text-xs text-neutral-500">last 30 days</span>
        </div>
        <svg viewBox="0 0 600 120" className="mt-3 h-28 w-full" role="img" aria-label="Views per day, last 30 days">
          {perDay.map((d, i) => {
            const h = Math.round((d.views / maxDay) * 100);
            const x = i * 20 + 2;
            return (
              <g key={d.day}>
                <title>{`${d.day}: ${d.views} view${d.views === 1 ? "" : "s"}`}</title>
                <rect x={x} y={110 - h} width={16} height={h} rx={2} className={d.views ? "fill-brand-500" : "fill-neutral-200"} />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
          <span>{perDay[0]?.day}</span>
          <span>{perDay[perDay.length - 1]?.day}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Trending this week</h2>
            <Link href="/admin/artifacts" className="text-sm text-brand-700 hover:underline">
              All artifacts →
            </Link>
          </div>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Artifact</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 text-right">7d</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Viewers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {top.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                      No artifacts yet.
                    </td>
                  </tr>
                ) : null}
                {top.map((a) => (
                  <tr key={a.id}>
                    <td className="max-w-[300px] px-3 py-2">
                      {a.visibility === "private" ? (
                        <span className="block truncate font-medium text-neutral-700">{a.title}</span>
                      ) : (
                        <Link href={`/a/${a.slug}`} className="block truncate font-medium text-neutral-900 hover:underline">
                          {a.title}
                        </Link>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={18} />
                        <span className="text-neutral-800">{a.ownerName ?? a.ownerEmail}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.views7d}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{a.viewCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{a.uniqueViewers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Latest activity</h2>
            <Link href="/admin/activity" className="text-sm text-brand-700 hover:underline">
              Full log →
            </Link>
          </div>
          <ul className="card mt-3 divide-y divide-neutral-100">
            {recent.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-neutral-500">No views yet.</li>
            ) : (
              recent.map((v) => (
                <li key={v.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <Avatar name={v.viewerName} email={v.viewerEmail} image={v.viewerImage} size={20} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-neutral-900">{v.viewerName ?? v.viewerEmail}</span>
                    <span className="text-neutral-500"> opened </span>
                    {v.visibility === "private" ? (
                      <span className="text-neutral-700">{v.title}</span>
                    ) : (
                      <Link href={`/a/${v.slug}`} className="text-neutral-800 hover:underline">
                        {v.title}
                      </Link>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{timeAgo(v.viewedAt)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, href }: { label: string; value: number; sub: string; href: string }) {
  return (
    <Link href={href} className="card block p-4 transition hover:border-neutral-300 hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </Link>
  );
}
