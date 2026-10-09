import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { parseShareEmails, setShares } from "@/lib/artifacts";
import { MAX_HTML_BYTES } from "@/lib/config";
import { generateAndStoreScreenshot } from "@/lib/generate-screenshot";
import { extractTitle, looksLikeHtml } from "@/lib/html";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Create an artifact from an uploaded HTML file (multipart form). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
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

  const title =
    String(form.get("title") ?? "").trim().slice(0, 200) ||
    extractTitle(html) ||
    file.name.replace(/\.html?$/i, "") ||
    "Untitled artifact";

  const visibility = form.get("visibility") === "restricted" ? "restricted" : "domain";
  const { emails, rejected } = parseShareEmails(String(form.get("shares") ?? ""), user.email);
  if (rejected.length) {
    return NextResponse.json(
      { error: `These addresses can't be shared with: ${rejected.join(", ")}` },
      { status: 400 },
    );
  }

  const id = nanoid(12);
  await db.insert(artifacts).values({
    id,
    ownerId: user.id,
    title,
    visibility,
    html,
    htmlBytes: Buffer.byteLength(html, "utf8"),
  });
  await setShares(id, emails);

  const screenshotOk = await generateAndStoreScreenshot(id, html);

  return NextResponse.json({ id, screenshotOk }, { status: 201 });
}
