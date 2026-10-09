import { appOrigin, authorizationServerMetadata } from "@/lib/oauth";
import { corsJson, OPTIONS } from "@/lib/oauth-http";

export { OPTIONS };

export async function GET(req: Request) {
  return corsJson(authorizationServerMetadata(appOrigin(req)), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
