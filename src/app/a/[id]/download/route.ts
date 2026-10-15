import { NextResponse } from "next/server";
import { getArtifactHtml, resolveHandle } from "@/lib/artifacts";
import { attachmentDisposition, downloadFileName } from "@/lib/download";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Send the artifact's HTML as a file to save, under exactly the access rules
 * that apply to viewing it. Unlike /raw, a download is not counted as a view.
 * The CSP `sandbox` stays on in case a client ignores the attachment
 * disposition and renders the document anyway.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const resolved = await resolveHandle((await params).id);
  if (!resolved) return new NextResponse("Not found", { status: 404 });
  const row = await getArtifactHtml(resolved.id, user);
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(row.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": attachmentDisposition(downloadFileName(row.title, resolved.slug)),
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Last-Modified": row.updatedAt.toUTCString(),
    },
  });
}
