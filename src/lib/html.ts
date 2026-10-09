/** Best-effort <title> extraction, used to prefill the artifact name. */
export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return t.length ? t.slice(0, 200) : null;
}

export function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 2000).toLowerCase();
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<div[\s>]|<svg[\s>]/.test(head);
}
