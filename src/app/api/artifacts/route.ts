import { NextResponse } from "next/server";
import { createArtifact, ServiceError } from "@/lib/artifact-service";
import { MAX_HTML_BYTES } from "@/lib/config";
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

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };

  try {
    const r = await createArtifact(user, {
      html: await file.text(),
      fileName: file.name,
      title: str("title"),
      description: str("description"),
      sourceUrl: str("sourceUrl"),
      tags: str("tags"),
      visibility: str("visibility"),
      shares: str("shares"),
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
