"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatShowingLabel } from "@/lib/showings";

export function ShowingPicker({ eventId, showings, basePath, selectedId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!showings?.length) {
    return <p className="text-sm text-muted">No showtimes have been saved for this event yet.</p>;
  }

  function choose(id) {
    if (id === selectedId) {
      return;
    }
    // Update the showing as a transition so the current page stays on screen
    // (no "Loading seats..." flash) and without jumping back to the top.
    startTransition(() => {
      router.push(`${basePath}?showing=${id}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Choose a date and time</h2>
        {isPending ? <span className="text-xs text-muted">Updating...</span> : null}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {showings.map((showing) => {
          const selected = showing.id === selectedId;

          return (
            <li key={showing.id}>
              <button
                type="button"
                onClick={() => choose(showing.id)}
                aria-pressed={selected}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selected ? "border-brand bg-brand/5" : "border-line bg-card hover:border-brand"
                }`}
              >
                <span className="font-medium">{formatShowingLabel(showing.startsAt || showing.starts_at)}</span>
                {showing.label ? <span className="mt-1 block text-muted">{showing.label}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}