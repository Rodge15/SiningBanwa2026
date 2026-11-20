import Link from "next/link";
import { LiveAvailability } from "@/components/LiveAvailability";
import { buttonClass } from "@/components/formStyles";
import { formatManilaDateTime, statusLabel } from "@/lib/eventRules";

export function EventCard({ event, href }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      {event.poster_path ? (
        <Link href={href} className="block">
          {/* The poster route checks access, then redirects to a short-lived signed URL.
              next/image would cache that file and could show a private poster later. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/events/${event.id}/poster`} alt={event.title} className="aspect-[16/9] w-full object-cover object-center" />
        </Link>
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
        {event.availability && !event.availability.layoutMissing && event.availability.capacity > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {event.availability.remaining} available
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
              {event.availability.booked ?? 0} booked
            </span>
            <span className="rounded-full border border-line bg-stone-100 px-2.5 py-1 text-stone-600">
              {event.availability.capacity} total
            </span>
          </div>
        ) : null}
        <p className="line-clamp-3 text-sm leading-6 text-muted">{event.description}</p>
        <div className="pt-2">
          <Link href={href} className={`${buttonClass} w-full sm:w-auto`}>
            Book now
          </Link>
        </div>
      </div>
    </article>
  );
}