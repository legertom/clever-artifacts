import { NextResponse } from "next/server";
import { replaceArtifactHtml, resolveForUser, ServiceError } from "@/lib/artifact-service";
import { MAX_HTML_BYTES } from "@/lib/config";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Replace the HTML of an artifact you own (multipart form with `file`). */
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an HTML file to upload" }, { status: 400 });
  }
  if (file.size > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.round(MAX_HTML_BYTES / 1024 / 1024)} MB)` },
      { status: 413 },
    );
  }

  try {
    const id = await resolveForUser((await params).id);
    const r = await replaceArtifactHtml(user, id, await file.text());
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
