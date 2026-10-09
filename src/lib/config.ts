/** Email domain allowed to sign in and to be shared with. */
export const ALLOWED_EMAIL_DOMAIN = (
  process.env.ALLOWED_EMAIL_DOMAIN ?? "clever.com"
).toLowerCase();

/** Upload cap. Vercel serverless functions reject bodies over ~4.5 MB. */
export const MAX_HTML_BYTES = 4 * 1024 * 1024;

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
