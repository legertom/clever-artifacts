import { downloadFileName } from "@/lib/download";

/**
 * Saves the artifact's HTML file. A plain link to /a/<slug>/download, so it
 * works with middle-click and "Save link as" and needs no client code. The
 * server names the file through Content-Disposition; there is deliberately no
 * `download` attribute, which would make an expired session save the login
 * page under the artifact's name instead of showing it. Pass children for a
 * labelled button, nothing for an icon-only one.
 */
export function DownloadLink({
  artifact,
  className = "",
  children,
}: {
  artifact: { slug: string; title: string };
  className?: string;
  children?: React.ReactNode;
}) {
  const fileName = downloadFileName(artifact.title, artifact.slug);
  return (
    <a
      href={`/a/${artifact.slug}/download`}
      title={`Download ${fileName}`}
      aria-label={children ? undefined : "Download the HTML file"}
      className={className}
    >
      <DownloadIcon size={15} />
      {children}
    </a>
  );
}

export function DownloadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v1.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
