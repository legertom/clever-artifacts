import type { Metadata } from "next";
import Link from "next/link";
import { AdminToggle } from "@/components/admin/admin-toggle";
import { Avatar } from "@/components/avatar";
import { adminList } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Admins" };

export default async function AdminAdminsPage() {
  const [admins, viewer] = await Promise.all([adminList(), getSessionUser()]);

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-neutral-500">
        Admins can open and manage every artifact, private ones included, and use this admin area. To add one, click the
        shield beside their name in{" "}
        <Link href="/admin/people" className="text-brand-700 hover:underline">
          People
        </Link>
        .
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Admin</th>
              <th className="px-3 py-2">Access</th>
              <th className="px-3 py-2">Last sign-in</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {admins.map((a) => (
              <tr key={a.email}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={a.name} email={a.email} image={a.image} size={24} />
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-900">
                        {a.name ?? a.email}
                        {a.id && a.id === viewer?.id ? <span className="ml-1.5 font-normal text-neutral-500">(you)</span> : null}
                      </span>
                      <span className="block max-w-[320px] truncate text-xs text-neutral-500">
                        {a.email}
                        {a.title ? ` · ${a.title}` : ""}
                        {a.department ? ` · ${a.department}` : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                  {a.source === "config" ? (
                    <span title="Named in the ADMIN_EMAILS setting; change it there.">Built in</span>
                  ) : (
                    "Promoted"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                  {a.lastLoginAt ? timeAgo(a.lastLoginAt) : <span className="text-neutral-400">never</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {/* Built-in admins are fixed, and nobody removes their own access. */}
                  {a.source === "promoted" && a.id && a.id !== viewer?.id ? (
                    <AdminToggle userId={a.id} name={a.name ?? a.email} isAdmin variant="button" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        {admins.length} {admins.length === 1 ? "admin" : "admins"}. Built-in admins come from the app&apos;s{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5">ADMIN_EMAILS</code> setting and can&apos;t be removed here.
      </p>
    </div>
  );
}
