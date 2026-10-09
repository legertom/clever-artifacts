import type { Metadata } from "next";
import Link from "next/link";
import { ManagerPicker } from "@/components/admin/manager-picker";
import { Pager } from "@/components/admin/pager";
import { AdminToolbar } from "@/components/admin/toolbar";
import { Avatar } from "@/components/avatar";
import { DirectoryImport } from "@/components/directory-import";
import { ADMIN_PAGE_SIZE, adminPeoplePage, PEOPLE_FILTER_LABELS, PEOPLE_FILTERS, type PeopleFilter } from "@/lib/admin";
import { ADMIN_EMAILS, ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · People" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export default async function AdminPeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const filter = (PEOPLE_FILTERS as readonly string[]).includes(one(sp.filter)) ? (one(sp.filter) as PeopleFilter) : "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { rows, total } = await adminPeoplePage({ q, filter, page });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-neutral-500">
          Everyone who has signed in or been imported from the directory. Imported people can be added to share lists
          before their first sign-in. Click a manager to change who someone reports to; that drives “My direct reports”
          sharing.
        </p>
        <DirectoryImport domain={ALLOWED_EMAIL_DOMAIN} />
      </div>

      <AdminToolbar
        action="/admin/people"
        q={q}
        placeholder="Search by name, email, title, department or manager"
        selects={[
          { name: "filter", label: "Show", value: filter, options: PEOPLE_FILTERS.map((f) => ({ value: f, label: PEOPLE_FILTER_LABELS[f] })) },
        ]}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Reports to</th>
              <th className="px-3 py-2 text-right">Reports</th>
              <th className="px-3 py-2">Last sign-in</th>
              <th className="px-3 py-2 text-right">Artifacts</th>
              <th className="px-3 py-2 text-right">Views</th>
              <th className="px-3 py-2">Last view</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                  Nobody matches.
                </td>
              </tr>
            ) : null}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={p.name} email={p.email} image={p.image} size={24} />
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-900">
                        {p.name ?? p.email}
                        {ADMIN_EMAILS.has(p.email) ? <span className="badge ml-1.5 border-violet-200 bg-violet-50 text-violet-800">admin</span> : null}
                      </span>
                      <span className="block max-w-[320px] truncate text-xs text-neutral-500">
                        {p.email}
                        {p.title ? ` · ${p.title}` : ""}
                        {p.department ? ` · ${p.department}` : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ManagerPicker userId={p.id} current={p.managerEmail} currentName={p.managerName} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.reportCount ? (
                    <Link href={`/admin/people?q=${encodeURIComponent(p.email)}`} className="text-brand-700 hover:underline" title="Show this person's reports">
                      {p.reportCount}
                    </Link>
                  ) : (
                    <span className="text-neutral-400">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                  {p.lastLoginAt ? timeAgo(p.lastLoginAt) : <span className="text-neutral-400">never</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.artifactsOwned}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.viewsMade}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{p.lastViewAt ? timeAgo(p.lastViewAt) : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/people" params={{ q, filter: filter === "all" ? undefined : filter }} />
    </div>
  );
}
