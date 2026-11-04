import Link from "next/link";
import { LiveAvailability } from "@/components/LiveAvailability";
import { formatManilaDateTime, statusLabel } from "@/lib/eventRules";

export function EventCard({ event, href }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      {event.poster_path ? (
              // The poster route checks access, then redirects to a short-lived signed URL.
              // next/image would cache that file and could show a private poster later.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/events/${event.id}/poster`} alt="" className="h-48 w-full object-cover" />
            ) : null}
      <div className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">
            <Link href={href} className="hover:text-brand">
              {event.title}
            </Link>
          </h2>
          <span className="rounded-full border border-line px-2 py-1 text-xs text-muted">
            {statusLabel(event.status)}
          </span>
        </div>
        <p className="text-sm text-muted">{formatManilaDateTime(event.starts_at)}</p>
        <p className="text-sm">{event.venue}</p>
        <LiveAvailability eventId={event.id} initial={event.availability} />
        <p className="line-clamp-3 text-sm leading-6 text-muted">{event.description}</p>
      </div>
    </article>
  );
}
