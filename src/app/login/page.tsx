import type { Metadata } from "next";
import { signInWithGoogle } from "@/actions/auth";
import { Logo } from "@/components/logo";
import { ALLOWED_EMAIL_DOMAIN, TRASH_RETENTION_DAYS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Clever Artifacts — share Claude artifacts without re-running them",
  description:
    "Upload the HTML export of a Claude artifact, share it with exactly the right people at Clever, and never pay to re-run it again.",
};

const ERRORS: Record<string, string> = {
  AccessDenied: `Use your @${ALLOWED_EMAIL_DOMAIN} Google account to sign in.`,
  OAuthAccountNotLinked: "That Google account is linked to a different login.",
  Configuration: "Sign-in isn't configured yet. Check the server's Google OAuth settings.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const { callbackUrl, error } = await searchParams;
  const cb = typeof callbackUrl === "string" ? callbackUrl : "/";
  const errorKey = typeof error === "string" ? error : null;
  const errorText = errorKey ? (ERRORS[errorKey] ?? "Sign-in failed. Please try again.") : null;

  const signIn = (
    <form action={signInWithGoogle}>
      <input type="hidden" name="callbackUrl" value={cb} />
      <button type="submit" className="btn-primary px-5 py-2.5 text-[15px]">
        <GoogleMark />
        Continue with Google
      </button>
    </form>
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-neutral-600">
            <a href="#features" className="hidden hover:text-neutral-900 sm:inline">
              Features
            </a>
            <a href="#how" className="hidden hover:text-neutral-900 sm:inline">
              How it works
            </a>
            <a href="#mcp" className="hidden hover:text-neutral-900 sm:inline">
              MCP
            </a>
            <form action={signInWithGoogle}>
              <input type="hidden" name="callbackUrl" value={cb} />
              <button type="submit" className="btn-secondary px-3 py-1.5">
                Sign in
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(37,99,235,0.14),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
            <div>
              <span className="badge border-brand-200 bg-brand-50 text-brand-800">For everyone at {ALLOWED_EMAIL_DOMAIN}</span>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
                Share Claude artifacts once. <span className="text-brand-700">Never re-run them.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
                Every time someone reloads an artifact in Claude, it reloads its data and bills us again. Upload the
                HTML export here instead: a fixed snapshot with a clean link, shared with exactly the people who should
                see it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {signIn}
                <span className="text-sm text-neutral-500">Your Clever Google account. No new password.</span>
              </div>
              {errorText ? (
                <p role="alert" className="mt-5 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorText}
                </p>
              ) : null}
            </div>
            <HeroIllustration />
          </div>
        </section>

        {/* Why */}
        <section className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
            <Stat value="$0" label="to open an artifact again. The data is baked in, so nothing re-runs." />
            <Stat value="1 link" label="per artifact, readable and permanent. Rename it and the old link still works." />
            <Stat value="Only you" label="can see a new upload until you decide who else should." />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Everything you need, nothing to configure</h2>
          <p className="mt-2 max-w-2xl text-neutral-600">
            Built for the way artifacts actually get used at Clever: made in a conversation, shared in a thread, opened by
            someone a month later.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<IconLock />}
              title="Private by default"
              text="New uploads are visible only to you. Open them up to specific teammates by email, or to everyone at the company, whenever you're ready."
            />
            <Feature
              icon={<IconLink />}
              title="Links people can read"
              text="clever-artifacts.vercel.app/a/q3-renewals beats a 40-character hash. Pick your own link or let the name make one; old links keep redirecting."
            />
            <Feature
              icon={<IconImage />}
              title="A dashboard with real previews"
              text="Every upload gets a screenshot, so your dashboard looks like your work, not a list of filenames. Search by name, description, #tag or person."
            />
            <Feature
              icon={<IconShield />}
              title="Safe to open"
              text="Artifacts run in a sandbox that can't touch your session or anyone else's data, even when opened full screen."
            />
            <Feature
              icon={<IconRefresh />}
              title="New version, same link"
              text="Regenerated the artifact in Claude? Replace the file and the preview updates. Nobody has to find a new URL."
            />
            <Feature
              icon={<IconTrash />}
              title="A trash can, not a delete button"
              text={`Anything you remove sits in the trash for ${TRASH_RETENTION_DAYS} days with a countdown, and one click brings it back.`}
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Three steps, about a minute</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              <Step n={1} title="Download from Claude" text="In Claude, open the artifact and download it as an HTML file. It's a complete, self-contained page." />
              <Step n={2} title="Upload it here" text="Drop the file in. The name, link and preview are filled in for you; add a description, tags, and who can see it." />
              <Step n={3} title="Share the link" text="Paste it in Slack, a doc, or a deck. Teammates sign in with Google and see exactly what you saw, instantly." />
            </ol>
          </div>
        </section>

        {/* MCP */}
        <section id="mcp" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="badge border-violet-200 bg-violet-50 text-violet-800">Works inside Claude too</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">Connect it as an MCP server</h2>
              <p className="mt-3 text-neutral-600">
                Add Clever Artifacts as a connector in Claude, Claude Code or Cursor and let the assistant do the
                busywork: publish the artifact it just made, find the one your teammate mentioned, update sharing, or
                tidy up the trash. Sign in once with Google; every action runs as you.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-neutral-700">
                <li className="flex gap-2"><Check /> “Publish this artifact and share it with the renewals team.”</li>
                <li className="flex gap-2"><Check /> “What did Priya share with me this week?”</li>
                <li className="flex gap-2"><Check /> “Replace the Q3 dashboard with this new version.”</li>
              </ul>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-100 shadow-sm">
              <code>{`# Claude Code
claude mcp add --transport http clever-artifacts \\
  https://clever-artifacts.vercel.app/api/mcp

# Claude (web or desktop)
Settings → Connectors → Add custom connector
→ paste the URL → Connect → Allow`}</code>
            </pre>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-neutral-200 bg-brand-700">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Stop paying for reloads.</h2>
              <p className="mt-1 text-brand-100">Sign in with your @{ALLOWED_EMAIL_DOMAIN} account and upload your first artifact.</p>
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="callbackUrl" value={cb} />
              <button type="submit" className="btn border-white bg-white px-5 py-2.5 text-[15px] text-brand-800 hover:bg-brand-50">
                <GoogleMark />
                Continue with Google
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-6">
          <span>Clever Artifacts · internal tool · only @{ALLOWED_EMAIL_DOMAIN} accounts can sign in</span>
          <span>Questions? Ask in #claude.</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tight text-neutral-900">{value}</div>
      <p className="mt-1 text-sm text-neutral-600">{label}</p>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card p-5">
      <div className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="card p-5">
      <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{n}</span>
      <h3 className="mt-3 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
    </li>
  );
}

function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="card overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="ml-2 flex-1 truncate rounded bg-white px-2 py-0.5 font-mono text-[11px] text-neutral-500">
            clever-artifacts.vercel.app/a/q3-district-renewals
          </span>
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-40 rounded bg-neutral-800" />
              <div className="mt-1.5 h-2 w-56 rounded bg-neutral-200" />
            </div>
            <span className="badge border-brand-200 bg-brand-50 text-brand-800">Shared with you</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["94.2%", "1,284", "$2.1M", "11"].map((v) => (
              <div key={v} className="rounded-lg border border-neutral-200 p-2.5">
                <div className="h-1.5 w-10 rounded bg-neutral-200" />
                <div className="mt-1.5 text-sm font-semibold text-neutral-900">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-neutral-200 p-2.5">
              <svg viewBox="0 0 120 40" className="h-12 w-full">
                <polyline points="2,34 20,30 38,28 56,24 74,20 92,12 118,4" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex items-end gap-1.5 rounded-lg border border-neutral-200 p-2.5">
              {[40, 55, 35, 70, 60, 85].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-brand-500/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md sm:block">
        <span className="font-medium text-neutral-900">Reloaded 212×</span>
        <span className="text-neutral-500"> · cost $0.00</span>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-emerald-600" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 12a8 8 0 01-14.3 4.9M4 12a8 8 0 0114.3-4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
