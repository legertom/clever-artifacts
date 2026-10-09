"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/artifacts", label: "Artifacts" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 border-b border-neutral-200" aria-label="Admin sections">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
