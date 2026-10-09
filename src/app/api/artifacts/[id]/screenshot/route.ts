import { NextResponse } from "next/server";
import { regeneratePreview, resolveForUser, ServiceError } from "@/lib/artifact-service";
import { getArtifactScreenshot } from "@/lib/artifacts";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** The stored preview image. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let id: string;
  try {
    id = await resolveForUser((await params).id);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const row = await getArtifactScreenshot(id, user);
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (!row.screenshot) return new NextResponse("No preview yet", { status: 404 });

  return new NextResponse(new Uint8Array(Buffer.from(row.screenshot, "base64")), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "Last-Modified": row.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Regenerate the preview (owner or admin). */
export async function POST(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await resolveForUser((await params).id);
    return NextResponse.json(await regeneratePreview(user, id));
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
  }
}
