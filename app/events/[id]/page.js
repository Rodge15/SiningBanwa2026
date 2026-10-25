import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveSeatMap } from "@/components/LiveSeatMap";
import { eventSetupMessage, getVisibleEvent, isMissingEventTable } from "@/lib/events";
import { attachAudience } from "@/lib/audience";
import { formatManilaDateTime, isUuid } from "@/lib/eventRules";
import { getEventLayout, isMissingSeatTable } from "@/lib/seats";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const metadata = {
  title: "Event | Sining Banwa",
};

async function EventDetails({ params }) {
  const { id } = await params;

  if (!getPublicSupabaseEnv().configured) {
      return (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Supabase is not connected yet. Add the project URL and keys to <code>.env.local</code>, then
          restart the dev server.
        </p>
      );
    }

    if (!isUuid(id)) {
      notFound();
    }

  const { data, error } = await getVisibleEvent(id);

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {isMissingEventTable(error) ? eventSetupMessage() : "This event could not be loaded."}
      </p>
    );
  }

  if (!data || data.status !== "published") {
    notFound();
  }

  const audience = await attachAudience([data]);
  const availability = audience.events?.[0]?.availability;
  const layout = data.admission_type === "general" ? { data: { sections: [] }, error: null } : await getEventLayout(data.id);
  const seatError = layout.error && !isMissingSeatTable(layout.error);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      {data.poster_path ? (
        <Link href={`/events/${data.id}/poster/view`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/events/${data.id}/poster`} alt="" className="max-h-96 w-full object-cover" />
          <span className="sr-only">View poster</span>
        </Link>
      ) : null}
      <div className="space-y-4 p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Published event</p>
        <h1 className="text-3xl font-semibold">{data.title}</h1>
        <p className="text-muted">{formatManilaDateTime(data.starts_at)}</p>
        <p>
          <span className="text-muted">Venue: </span>
          {data.venue}
        </p>
        <p className="whitespace-pre-wrap leading-7">{data.description}</p>
        {data.poster_path ? (
          <p>
            <Link href={`/events/${data.id}/poster/view`} className="text-sm text-brand hover:underline">
              View poster
            </Link>
          </p>
        ) : null}
        <div className="space-y-3 border-t border-line pt-4">
          <h2 className="text-xl font-semibold">{data.admission_type === "general" ? "Tickets" : "Seating layout"}</h2>
          <p className="text-sm font-medium">{availability?.label || "Availability is not ready yet."}</p>
          {data.admission_type === "general" ? (
            <p className="text-sm text-muted">This show does not use a seat map. Ticket price: set by the organizer.</p>
          ) : (
            <p className="text-sm text-muted">Seat colors show the tier. The outline shows whether a seat is free, held, or paid.</p>
          )}
          {seatError ? <p className="text-sm text-red-900">The seating layout could not be loaded.</p> : null}
          {data.admission_type !== "general" && !layout.error && layout.data.sections.length === 0 ? (
            <p className="text-sm text-muted">No seating layout has been saved for this event yet.</p>
          ) : null}
          {data.admission_type !== "general" && !layout.error && layout.data.sections.length > 0 ? (
            <LiveSeatMap eventId={data.id} initialSections={layout.data.sections} />
          ) : null}
          {availability?.full ? (
            <p className="text-sm text-muted">This show is Full, so customers cannot reserve it.</p>
          ) : (
            <p>
              <Link href={`/events/${data.id}/reserve`} className="text-sm text-brand hover:underline">
                {data.admission_type === "general" ? "Reserve tickets" : "Choose seats"}
              </Link>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function EventDetailPage({ params }) {
  return (
    <section className="space-y-4">
      <Link href="/events" className="text-sm text-brand hover:underline">
        Back to events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading event...</p>}>
        <EventDetails params={params} />
      </Suspense>
    </section>
  );
}
