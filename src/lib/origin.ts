import { headers } from "next/headers";

/** Public origin of this deployment, for building absolute links in server components. */
export async function getOrigin(): Promise<string> {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL;
  if (configured) return new URL(configured).origin;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
