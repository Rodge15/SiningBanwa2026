import Link from "next/link";
import { formatShowingLabel } from "@/lib/showings";

export function ShowingPicker({ eventId, showings, basePath, selectedId }) {
  if (!showings?.length) {
    return <p className="text-sm text-muted">No showtimes have been saved for this event yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Choose a date and time</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {showings.map((showing) => {
          const selected = showing.id === selectedId;
          const href = `${basePath}?showing=${showing.id}`;

          return (
            <li key={showing.id}>
              <Link
                href={href}
                className={`block rounded-xl border px-3 py-2 text-sm ${selected ? "border-brand bg-brand/5" : "border-line bg-card"}`}
              >
                <span className="font-medium">{formatShowingLabel(showing.startsAt || showing.starts_at)}</span>
                {showing.label ? <span className="mt-1 block text-muted">{showing.label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
