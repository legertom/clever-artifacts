import { NextResponse } from "next/server";
import { getArtifactHtml } from "@/lib/artifacts";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve the artifact's HTML. The CSP `sandbox` directive gives the document
 * an opaque origin, so scripts inside an uploaded artifact can't read our
 * cookies or call our API as the viewer, even when opened in its own tab.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = await getArtifactHtml(id, user);
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(row.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox; frame-ancestors 'self'",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Last-Modified": row.updatedAt.toUTCString(),
    },
  });
}
