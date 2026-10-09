import { NextResponse } from "next/server";
import { parseDirectory, upsertDirectory } from "@/lib/directory-import";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/** Admin-only: upload an employee directory (CSV or XLSX) to seed the people list. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a .csv or .xlsx file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is too large (max 5 MB)" }, { status: 413 });
  if (!/\.(csv|xlsx)$/i.test(file.name)) return NextResponse.json({ error: "Only .csv and .xlsx files are supported" }, { status: 400 });

  try {
    const { rows, skipped, columns } = await parseDirectory(Buffer.from(await file.arrayBuffer()), file.name);
    if (!rows.length) {
      return NextResponse.json({ error: `No usable rows. Columns seen: ${columns.join(", ") || "none"}` }, { status: 400 });
    }
    const { inserted, updated } = await upsertDirectory(rows);
    return NextResponse.json({ parsed: rows.length, inserted, updated, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    console.error("[directory import]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
