import type { Metadata } from "next";
import { signInWithGoogle } from "@/actions/auth";
import { Logo } from "@/components/logo";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: `Use your @${ALLOWED_EMAIL_DOMAIN} Google account to sign in.`,
  OAuthAccountNotLinked: "That Google account is linked to a different login.",
  Configuration: "Sign-in isn't configured yet. Check the server's Google OAuth settings.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { callbackUrl, error } = await searchParams;
  const cb = typeof callbackUrl === "string" ? callbackUrl : "/";
  const errorKey = typeof error === "string" ? error : null;
  const errorText = errorKey ? (ERRORS[errorKey] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Share Claude artifacts with teammates without re-running them. Clever accounts only.
        </p>

        {errorText ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorText}
          </p>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="callbackUrl" value={cb} />
          <button type="submit" className="btn-secondary w-full py-2.5">
            <GoogleMark />
            Continue with Google
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-400">
          Only @{ALLOWED_EMAIL_DOMAIN} addresses can sign in.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
