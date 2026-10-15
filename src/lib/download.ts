/**
 * The file name offered when someone downloads an artifact: the title people
 * recognise, plus the slug so two artifacts with the same title don't collide
 * and the file can be traced back to its link.
 *
 *   "Q3 Renewals" + "q3-renewals" → "Q3 Renewals (q3-renewals).html"
 */
export function downloadFileName(title: string, slug: string): string {
  const safeTitle = Array.from(
    title
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ") // characters no common file system allows
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, 120)
    .join("")
    .replace(/[. ]+$/, ""); // Windows drops trailing dots and spaces
  return safeTitle ? `${safeTitle} (${slug}).html` : `${slug}.html`;
}

/**
 * Content-Disposition for an attachment. `filename*` carries the real UTF-8
 * name (RFC 6266 / 8187); the plain `filename` is an ASCII fallback for
 * clients that don't understand the starred form.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc8187(fileName)}`;
}

/** Percent-encode everything outside RFC 8187's attr-char set. */
function encodeRfc8187(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
