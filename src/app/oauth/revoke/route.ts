import { revokeToken } from "@/lib/oauth";
import { corsJson, OPTIONS, readParams } from "@/lib/oauth-http";

export { OPTIONS };

/** RFC 7009. Always 200 so callers can't probe token validity. */
export async function POST(req: Request) {
  const p = await readParams(req);
  if (p.token) await revokeToken(p.token).catch(() => {});
  return corsJson({});
}
