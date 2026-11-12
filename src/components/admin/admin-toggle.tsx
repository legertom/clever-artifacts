"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { setAdminAction } from "@/actions/admin";
import { Spinner } from "@/components/upload-form";

/**
 * Promote someone to admin, or take it back. Asks first.
 * `icon`: a small shield beside a name (People). `button`: a labelled button (Admins).
 */
export function AdminToggle({
  userId,
  name,
  isAdmin,
  variant = "icon",
}: {
  userId: string;
  name: string;
  isAdmin: boolean;
  variant?: "icon" | "button";
}) {
  const [confirming, setConfirming] = useState(false);
  const label = isAdmin ? `Remove ${name}’s admin access` : `Make ${name} an admin`;
  const short = isAdmin ? "Remove admin" : "Make admin";

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={label}
          title={short}
          className={`inline-grid size-6 shrink-0 place-items-center rounded-full align-middle transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
            isAdmin ? "text-violet-600 hover:bg-violet-100 hover:text-violet-800" : "text-neutral-500 hover:bg-violet-50 hover:text-violet-700"
          }`}
        >
          <ShieldIcon filled={isAdmin} size={16} />
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} aria-label={label} className={`${isAdmin ? "btn-danger" : "btn-secondary"} px-2.5 py-1 text-xs`}>
          {short}
        </button>
      )}
      {confirming ? <ConfirmDialog userId={userId} name={name} makeAdmin={!isAdmin} onClose={() => setConfirming(false)} /> : null}
    </>
  );
}

function ConfirmDialog({ userId, name, makeAdmin, onClose }: { userId: string; name: string; makeAdmin: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Native <dialog> in modal mode: top layer, focus trap, Escape to dismiss, ::backdrop.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function confirm() {
    setError(null);
    start(async () => {
      // The action revalidates the admin pages, so the row re-renders with the new state.
      const r = await setAdminAction(userId, makeAdmin);
      if (r.ok) onClose();
      else setError(r.error);
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
      <div className="whitespace-normal p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700">
            <ShieldIcon filled={makeAdmin} size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-neutral-900">
              {makeAdmin ? `Make ${name} an admin?` : `Remove ${name}’s admin access?`}
            </h2>
            <p className="mt-1.5 text-sm font-normal leading-relaxed text-neutral-600">
              {makeAdmin ? (
                <>
                  Admins can{" "}
                  <strong className="font-semibold text-neutral-800">open and manage every artifact, private ones included</strong>,
                  use this admin area, and make other people admins. It takes effect right away.
                </>
              ) : (
                <>
                  They go back to seeing only their own artifacts and what&apos;s shared with them, and lose this admin area. It
                  takes effect right away.
                </>
              )}
            </p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm font-normal text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={
              makeAdmin
                ? "btn border-violet-600 bg-violet-600 text-white hover:border-violet-700 hover:bg-violet-700"
                : "btn border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700"
            }
            onClick={confirm}
            disabled={pending}
          >
            {pending ? <Spinner /> : <ShieldIcon filled={makeAdmin} size={15} />} {makeAdmin ? "Make admin" : "Remove admin"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function ShieldIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 2.6v5.6c0 4.3-2.8 7.9-7 9.8-4.2-1.9-7-5.5-7-9.8V5.6L12 3z"
        fill="currentColor"
        fillOpacity={filled ? 0.18 : 0}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {filled ? (
        <path d="M8.8 12.2l2.3 2.3 4.2-4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M12 8.8v5.6M9.2 11.6h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
