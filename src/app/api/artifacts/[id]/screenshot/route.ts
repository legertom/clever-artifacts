import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { getArtifactScreenshot, getOwnedArtifact } from "@/lib/artifacts";
import { generateAndStoreScreenshot } from "@/lib/generate-screenshot";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** The stored preview image. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
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

/** Regenerate the preview (owner only). */
export async function POST(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedArtifact(id, user);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select({ html: artifacts.html })
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(artifacts)
    .set({ screenshotStatus: "pending", screenshotError: null, updatedAt: new Date() })
    .where(eq(artifacts.id, id));

  const ok = await generateAndStoreScreenshot(id, row.html);
  if (!ok) {
    const [after] = await db
      .select({ error: artifacts.screenshotError })
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1);
    return NextResponse.json(
      { error: after?.error ?? "Preview generation failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
