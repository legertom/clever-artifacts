import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Nav } from "@/components/nav";
import { adminListArtifacts, adminListUsers, adminOverview, adminRecentViews, adminViewsPerDay } from "@/lib/admin";
import { purgeDate } from "@/lib/artifacts";
import { ADMIN_EMAILS, ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { formatBytes, timeAgo } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireAdmin();
  const [overview, artifacts, people, recent, perDay] = await Promise.all([
    adminOverview(),
    adminListArtifacts(),
    adminListUsers(),
    adminRecentViews(40),
    adminViewsPerDay(30),
  ]);
  const maxDay = Math.max(1, ...perDay.map((d) => d.views));

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Admin</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Everything in Clever Artifacts, including other people&apos;s and trashed items. Admins:{" "}
              {[...ADMIN_EMAILS].join(", ")}.
            </p>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Artifacts" value={overview.artifactsActive} sub={`${overview.artifactsTrashed} in trash · ${formatBytes(overview.totalBytes)}`} />
          <Tile label="People signed in" value={overview.users} sub={`${overview.activeUsers7d} active in the last 7 days`} />
          <Tile label="Views" value={overview.views} sub={`${overview.views7d} last 7 days · ${overview.views30d} last 30`} />
          <Tile label="Unique viewers" value={overview.uniqueViewers} sub="people who opened at least one artifact" />
        </section>

        <section className="card mt-6 p-5">
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

        <section className="mt-8">
          <h2 className="text-base font-semibold text-neutral-900">All artifacts</h2>
          <div className="card mt-3 overflow-x-auto">
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
                {artifacts.map((a) => (
                  <tr key={a.id} className={a.trashedAt ? "bg-amber-50/40" : ""}>
                    <td className="max-w-[280px] px-3 py-2">
                      {a.visibility === "private" ? (
                        <span className="block truncate font-medium text-neutral-700" title="Private: only the owner can open it">
                          {a.title}
                        </span>
                      ) : (
                        <Link href={`/a/${a.slug}`} className="block truncate font-medium text-neutral-900 hover:underline">
                          {a.title}
                        </Link>
                      )}
                      <span className="block truncate font-mono text-[11px] text-neutral-400">/a/{a.slug}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Avatar name={a.ownerName} email={a.ownerEmail} image={a.ownerImage} size={18} />
                        <span className="text-neutral-800">{a.ownerName ?? a.ownerEmail}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                      {a.visibility === "private"
                        ? "owner only"
                        : a.visibility === "domain"
                          ? `everyone @${ALLOWED_EMAIL_DOMAIN}`
                          : `${a.shareCount} ${a.shareCount === 1 ? "person" : "people"}`}
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
                      {a.visibility === "private" ? null : (
                        <Link href={`/a/${a.slug}/settings`} className="btn-ghost px-2 py-1 text-xs">
                          Manage
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {artifacts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-neutral-500">
                      No artifacts yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <h2 className="text-base font-semibold text-neutral-900">People</h2>
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Person</th>
                    <th className="px-3 py-2">Last sign-in</th>
                    <th className="px-3 py-2 text-right">Artifacts</th>
                    <th className="px-3 py-2 text-right">Views</th>
                    <th className="px-3 py-2">Last view</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={p.name} email={p.email} image={p.image} size={22} />
                          <span>
                            <span className="block font-medium text-neutral-900">{p.name ?? p.email}</span>
                            <span className="block text-xs text-neutral-500">
                              {p.email}
                              {ADMIN_EMAILS.has(p.email) ? " · admin" : ""}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{timeAgo(p.lastLoginAt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.artifactsOwned}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.viewsMade}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{p.lastViewAt ? timeAgo(p.lastViewAt) : "never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="lg:col-span-2">
            <h2 className="text-base font-semibold text-neutral-900">Recent activity</h2>
            <ul className="card mt-3 divide-y divide-neutral-100">
              {recent.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-neutral-500">No views yet.</li>
              ) : (
                recent.map((v, i) => (
                  <li key={`${v.viewedAt.getTime()}-${i}`} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                    <Avatar name={v.viewerName} email={v.viewerEmail} image={v.viewerImage} size={20} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-neutral-900">{v.viewerName ?? v.viewerEmail}</span>
                      <span className="text-neutral-500"> opened </span>
                      <Link href={`/a/${v.slug}`} className="text-neutral-800 hover:underline">
                        {v.title}
                      </Link>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">{timeAgo(v.viewedAt)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
