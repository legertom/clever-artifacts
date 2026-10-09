"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { setFavoriteAction, trashArtifactAction } from "@/actions/artifacts";
import { Spinner } from "@/components/upload-form";

type Target = { id: string; title: string; favorited: boolean };

/**
 * Star + trash for one artifact card. The strip slides up over the card's
 * footer on hover (or keyboard focus); on touch devices, which have no hover,
 * it sits below the footer instead. Must be rendered inside a `group relative`
 * container.
 */
export function CardActions({
  artifact,
  canTrash,
  retentionDays,
}: {
  artifact: Target;
  /** Owners and admins may trash; everyone who can open the artifact may star it. */
  canTrash: boolean;
  retentionDays: number;
}) {
  const fav = useFavorite(artifact);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {fav.value ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-amber-500 shadow-sm ring-1 ring-black/5 touch:hidden"
        >
          <StarIcon filled size={15} />
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 border-t border-neutral-200 bg-white/95 px-2.5 py-1.5 backdrop-blur-sm transition-transform duration-200 ease-out group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transition-none touch:static touch:translate-y-0">
        <StarButton fav={fav} size="lg" />
        {fav.error ? <span className="min-w-0 truncate text-xs text-red-700">{fav.error}</span> : null}
        {canTrash ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Move to trash"
            title="Move to trash"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <TrashIcon size={17} />
          </button>
        ) : null}
      </div>

      {confirming ? (
        <ConfirmTrashDialog artifact={artifact} retentionDays={retentionDays} onClose={() => setConfirming(false)} />
      ) : null}
    </>
  );
}

/** Star toggle for the artifact viewer's header. */
export function FavoriteButton({ artifact }: { artifact: { id: string; favorited: boolean } }) {
  const fav = useFavorite(artifact);
  return (
    <span className="inline-flex items-center gap-1.5">
      <StarButton fav={fav} size="md" />
      {fav.error ? <span className="hidden text-xs text-red-700 sm:inline">{fav.error}</span> : null}
    </span>
  );
}

function useFavorite(artifact: { id: string; favorited: boolean }) {
  const [value, setOptimistic] = useOptimistic(artifact.favorited);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () =>
    start(async () => {
      const next = !value;
      setOptimistic(next);
      setError(null);
      const r = await setFavoriteAction(artifact.id, next);
      if (!r.ok) setError(r.error);
    });

  return { value, pending, error, toggle };
}

function StarButton({ fav, size }: { fav: ReturnType<typeof useFavorite>; size: "lg" | "md" }) {
  const label = fav.value ? "Remove from favorites" : "Add to favorites";
  return (
    <button
      type="button"
      onClick={fav.toggle}
      aria-pressed={fav.value}
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-lg transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
        size === "lg" ? "size-9" : "size-8"
      } ${fav.value ? "text-amber-500" : "text-neutral-400 hover:text-amber-500"} ${fav.pending ? "opacity-70" : ""}`}
    >
      <StarIcon filled={fav.value} size={size === "lg" ? 22 : 18} />
    </button>
  );
}

function ConfirmTrashDialog({
  artifact,
  retentionDays,
  onClose,
}: {
  artifact: Target;
  retentionDays: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = `trash-${artifact.id}-title`;

  // Native <dialog> in modal mode: top layer, focus trap, Escape to dismiss, ::backdrop.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function confirm() {
    start(async () => {
      const r = await trashArtifactAction(artifact.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClick={(e) => {
        // Clicks on the backdrop land on the <dialog> itself; clicks inside land on its children.
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-neutral-200 bg-white p-0 text-left text-neutral-900 shadow-xl backdrop:bg-neutral-900/40"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <TrashIcon size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-neutral-900">
              Move “{artifact.title}” to the trash?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              It disappears from everyone&apos;s dashboards and search right away. You can restore it from the Trash tab for
              the next {retentionDays} days.{" "}
              <strong className="font-semibold text-neutral-800">After {retentionDays} days it&apos;s deleted permanently</strong>,
              along with its share list and view history.
            </p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? <Spinner /> : <TrashIcon size={15} />} Move to trash
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function StarIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8L12 2.8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.1a1 1 0 001 .9h7.2a1 1 0 001-.9L17.5 7M10 11v5.5M14 11v5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
