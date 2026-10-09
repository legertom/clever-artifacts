import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { getOwnedArtifact } from "@/lib/artifacts";
import { MAX_HTML_BYTES } from "@/lib/config";
import { generateAndStoreScreenshot } from "@/lib/generate-screenshot";
import { looksLikeHtml } from "@/lib/html";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Replace the HTML of an artifact you own (multipart form with `file`). */
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedArtifact(id, user);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const html = await file.text();
  if (!html.trim() || !looksLikeHtml(html)) {
    return NextResponse.json({ error: "That file doesn't look like an HTML document" }, { status: 400 });
  }

  await db
    .update(artifacts)
    .set({
      html,
      htmlBytes: Buffer.byteLength(html, "utf8"),
      screenshotStatus: "pending",
      screenshotError: null,
      updatedAt: new Date(),
    })
    .where(eq(artifacts.id, id));

  const screenshotOk = await generateAndStoreScreenshot(id, html);
  return NextResponse.json({ id, screenshotOk });
}
