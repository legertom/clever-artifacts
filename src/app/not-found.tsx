import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 text-lg font-semibold text-neutral-900">Not found</h1>
        <p className="mt-1 text-sm text-neutral-500">
          This artifact doesn&apos;t exist, was deleted, or hasn&apos;t been shared with you.
        </p>
        <Link href="/" className="btn-secondary mt-6">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
