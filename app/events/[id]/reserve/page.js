import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QueryMessage } from "@/components/QueryMessage";
import { SeatPicker } from "@/components/SeatPicker";
import { TicketPicker } from "@/components/TicketPicker";
import { attachAudience } from "@/lib/audience";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent, isMissingEventTable, eventSetupMessage } from "@/lib/events";
import { getEventLayout, isMissingSeatTable, seatSetupMessage } from "@/lib/seats";
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

  const audience = await attachAudience([data]);
  const availability = audience.events?.[0]?.availability;
  const layout = data.admission_type === "general" ? { data: { sections: [] }, error: null } : await getEventLayout(data.id);
  const { profile } = await getCurrentProfile();
  const canReserve = Boolean(profile?.is_active && profile.role === "customer") && !availability?.full;
  const loginHref = `/login?next=${encodeURIComponent(`/events/${data.id}/reserve`)}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          {data.admission_type === "general" ? "Reserve tickets" : "Reserve seats"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{data.title}</h1>
        <p className="mt-2 text-sm font-medium">{availability?.label || "Availability is not ready yet."}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {data.admission_type === "general"
            ? "Choose how many tickets you need. A hold lasts five minutes unless an administrator changes that time in the database. Payment is not part of this step."
            : "Choose one or more available seats. A hold lasts five minutes unless an administrator changes that time in the database. Payment is not part of this step."}
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {layout.error ? (
        <p className="text-sm text-red-900">
          {isMissingSeatTable(layout.error) ? seatSetupMessage() : "The seating layout could not be loaded."}
        </p>
      ) : null}
      {availability?.full ? <p className="text-sm text-muted">This show is Full, so it cannot be reserved.</p> : null}
      {data.admission_type === "general" && !availability?.full ? (
        <TicketPicker
          eventId={data.id}
          ticketPrice={data.ticket_price}
          remaining={availability?.remaining || 0}
          canReserve={canReserve}
          signedIn={Boolean(profile)}
          loginHref={loginHref}
        />
      ) : null}
      {data.admission_type !== "general" && !layout.error && layout.data.sections.length === 0 ? (
        <p className="text-sm text-muted">No seating layout has been saved for this event yet.</p>
      ) : null}
      {data.admission_type !== "general" && !availability?.full && !layout.error && layout.data.sections.length > 0 ? (
        <SeatPicker
          eventId={data.id}
          initialSections={layout.data.sections}
          canReserve={canReserve}
          signedIn={Boolean(profile)}
          loginHref={loginHref}
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
