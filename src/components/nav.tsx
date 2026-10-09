import Link from "next/link";
import { signOutAction } from "@/actions/auth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { SearchForm } from "@/components/search-form";
import type { SessionUser } from "@/lib/session";

export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/" className="btn-ghost px-3 py-1.5">
              Dashboard
            </Link>
            <Link href="/upload" className="btn-ghost px-3 py-1.5">
              Upload
            </Link>
            <Link href="/settings/mcp" className="btn-ghost px-3 py-1.5">
              MCP
            </Link>
            {user.isAdmin ? (
              <Link href="/admin" className="btn-ghost px-3 py-1.5">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm size="sm" className="hidden w-56 lg:block xl:w-72" />
          <Link href="/search" className="btn-ghost px-2 py-1.5 lg:hidden" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/upload" className="btn-primary px-3 py-1.5 sm:hidden">
            Upload
          </Link>
          <div className="flex items-center gap-2">
            <Avatar name={user.name} email={user.email} image={user.image} size={28} />
            <span className="hidden text-sm text-neutral-700 md:inline">{user.name ?? user.email}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost px-2.5 py-1.5 text-neutral-500">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
