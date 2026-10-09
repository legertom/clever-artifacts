import { eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { screenshotHtml } from "@/lib/screenshot";

/**
 * Generate and store the preview for an artifact. Never throws: the outcome
 * is recorded on the row so the UI can show "preview failed" and offer retry.
 */
export async function generateAndStoreScreenshot(id: string, html: string): Promise<boolean> {
  try {
    const jpeg = await screenshotHtml(html);
    await db
      .update(artifacts)
      .set({
        screenshot: jpeg.toString("base64"),
        screenshotStatus: "ready",
        screenshotError: null,
      })
      .where(eq(artifacts.id, id));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[screenshot] artifact ${id}: ${message}`);
    await db
      .update(artifacts)
      .set({ screenshotStatus: "failed", screenshotError: message.slice(0, 500) })
      .where(eq(artifacts.id, id))
      .catch(() => {});
    return false;
  }
}
