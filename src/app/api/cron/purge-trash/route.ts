import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/artifacts";

/** Vercel Cron target (see vercel.json). Also runs lazily from the dashboard. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const purged = await purgeExpiredTrash();
  return NextResponse.json({ purged });
}
