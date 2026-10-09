import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { UploadForm } from "@/components/upload-form";
import { ALLOWED_EMAIL_DOMAIN, MAX_HTML_BYTES } from "@/lib/config";
import { directReportsOf } from "@/lib/artifacts";
import { getOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await requireUser();
  const [origin, reports] = await Promise.all([getOrigin(), directReportsOf(user.email)]);
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Upload an artifact</h1>
        <p className="mt-1 text-sm text-neutral-500">
          In Claude, download the artifact as an HTML file, then drop it here. The copy is static, so opening it
          never re-runs anything.
        </p>
        <div className="card mt-6 p-5 sm:p-6">
          <UploadForm domain={ALLOWED_EMAIL_DOMAIN} maxBytes={MAX_HTML_BYTES} origin={origin} reports={reports} />
        </div>
      </main>
    </>
  );
}
