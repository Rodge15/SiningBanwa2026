import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QueryMessage } from "@/components/QueryMessage";
import { SeatPicker } from "@/components/SeatPicker";
import { ShowingPicker } from "@/components/ShowingPicker";
import { TicketPicker } from "@/components/TicketPicker";
import { onlineSalesClosedReason } from "@/lib/bookingWindow";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent, isMissingEventTable, eventSetupMessage } from "@/lib/events";
import { getEventLayout, isMissingSeatTable, seatSetupMessage } from "@/lib/seats";
import { showingAvailability } from "@/lib/showingQueries";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const metadata = {
  title: "Reserve seats | Sining Banwa",
};

async function ReserveDetails({ params, searchParams }) {
  const { id } = await params;

  if (!getPublicSupabaseEnv().configured) {
    return <p className="text-sm text-muted">Supabase is not connected yet.</p>;
  }

  if (!isUuid(id)) {
    notFound();
  }

  const { data, error } = await getVisibleEvent(id);

  if (error) {
    return <p className="text-sm text-red-900">{isMissingEventTable(error) ? eventSetupMessage() : "This event could not be loaded."}</p>;
  }

  if (!data || data.status !== "published") {
    notFound();
  }

  const query = await searchParams;
  const showingId = isUuid(query?.showing) ? query.showing : "";
  const live = await showingAvailability(data, showingId);
  const availability = live.selected;
  const layout = data.admission_type === "general" ? { data: { sections: [] }, error: null } : await getEventLayout(data.id);
  const { profile } = await getCurrentProfile();
  const closedReason = availability ? onlineSalesClosedReason(availability.startsAt) : null;
  const layoutMissing = data.admission_type !== "general" && (!layout.error && layout.data.sections.length === 0 || availability?.layoutMissing);
  const canReserve = Boolean(profile?.is_active && profile.role === "customer") && Boolean(availability) && !availability.full && !layoutMissing && !closedReason;
  const loginHref = `/login?next=${encodeURIComponent(`/events/${data.id}/reserve?showing=${showingId}`)}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          {data.admission_type === "general" ? "Reserve tickets" : "Reserve seats"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{data.title}</h1>
        <p className="mt-2 text-sm font-medium">{availability?.label || "Choose a date and time."}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Choose a showing first. A hold lasts five minutes. After you pay, submit the reference and screenshot on the reservation page.
        </p>
      </div>
      {live.missing || isMissingShowingSetup(live.error) ? <p className="text-sm text-red-900">{showingSetupMessage()}</p> : null}
      <ShowingPicker eventId={data.id} showings={live.showings} basePath={`/events/${data.id}/reserve`} selectedId={showingId} />
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {layout.error ? (
        <p className="text-sm text-red-900">
          {isMissingSeatTable(layout.error) ? seatSetupMessage() : "The seating layout could not be loaded."}
        </p>
      ) : null}
      {layoutMissing ? <p className="text-sm text-muted">No seating layout has been saved for this event yet.</p> : null}
      {availability?.full ? <p className="text-sm text-muted">This showing is Full, so it cannot be reserved.</p> : null}
      {closedReason ? <p className="text-sm text-muted">{closedReason}</p> : null}
      {showingId && data.admission_type === "general" && availability && !availability.full ? (
        <TicketPicker
          eventId={data.id}
          showingId={showingId}
          ticketPrice={data.ticket_price}
          remaining={availability.remaining || 0}
          canReserve={canReserve}
          signedIn={Boolean(profile)}
          loginHref={loginHref}
          blockedMessage={closedReason}
        />
      ) : null}
      {showingId && data.admission_type !== "general" && availability && !availability.full && !layoutMissing && !layout.error ? (
        <SeatPicker
          eventId={data.id}
          showingId={showingId}
          initialSections={layout.data.sections}
          canReserve={canReserve}
          signedIn={Boolean(profile)}
          loginHref={loginHref}
          blockedMessage={closedReason}
        />
      ) : null}
    </div>
  );
}

export default function ReservePage({ params, searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events" className="text-sm text-brand hover:underline">
        Back to events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading seats...</p>}>
        <ReserveDetails params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
