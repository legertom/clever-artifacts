/** Email domain allowed to sign in and to be shared with. */
export const ALLOWED_EMAIL_DOMAIN = (
  process.env.ALLOWED_EMAIL_DOMAIN ?? "clever.com"
).toLowerCase();

/** People who can open /admin, see every artifact, and trash anyone's. */
export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env.ADMIN_EMAILS ?? "tom.leger@clever.com,kate.schaff@clever.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** Trashed artifacts are deleted for good after this many days. */
export const TRASH_RETENTION_DAYS = 30;

/** Upload cap. Vercel serverless functions reject bodies over ~4.5 MB. */
export const MAX_HTML_BYTES = 4 * 1024 * 1024;

export const LIMITS = {
  title: 200,
  description: 1000,
  sourceUrl: 2000,
  tags: 10,
  tagLength: 32,
  slug: 80,
} as const;

export const SCREENSHOT = {
  width: 1280,
  height: 800,
  jpegQuality: 78,
  /** How long to wait for the page's network to settle. */
  loadTimeoutMs: 20_000,
  /** Extra time for entry animations / charts to draw. */
  settleMs: 1_000,
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  return e.slice(at + 1) === ALLOWED_EMAIL_DOMAIN;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}
