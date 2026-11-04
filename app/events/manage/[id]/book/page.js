import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminBooker } from "@/components/AdminBooker";
import { QueryMessage } from "@/components/QueryMessage";
import { ShowingPicker } from "@/components/ShowingPicker";
import { requireRole } from "@/lib/auth";
import { formatManilaDateTime, isUuid } from "@/lib/eventRules";
import { eventSetupMessage, getVisibleEvent, isMissingEventTable } from "@/lib/events";
import { isMissingReservationSetup, listEventReservations, reservationSetupMessage } from "@/lib/reservations";
import { reservationSourceLabel, reservationStatusLabel } from "@/lib/reservationRules";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";
import { getEventLayout, isMissingSeatTable, seatSetupMessage } from "@/lib/seats";
import { showingAvailability } from "@/lib/showingQueries";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";

export const metadata = {
  title: "Record a booking | Sining Banwa",
};

async function Booker({ params, searchParams }) {
  const { id } = await params;
  await requireRole(EVENT_MANAGER_ROLES);

  if (!isUuid(id)) {
    notFound();
  }

  const { data, error } = await getVisibleEvent(id);

  if (error) {
    return (
      <p className="text-sm text-red-900">
        {isMissingEventTable(error) ? eventSetupMessage() : "This event could not be loaded."}
      </p>
    );
  }

  if (!data) {
    notFound();
  }

  const query = await searchParams;
  const showingId = isUuid(query?.showing) ? query.showing : "";
  const live = await showingAvailability(data, showingId);
  const availability = live.selected;
  const layout = data.admission_type === "general" ? { data: { sections: [] }, error: null } : await getEventLayout(data.id);
  const records = await listEventReservations(data.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff booking</p>
        <h1 className="mt-1 text-3xl font-semibold">{data.title}</h1>
        <p className="mt-2 text-sm text-muted">{formatManilaDateTime(data.starts_at)}</p>
        <p className="mt-2 text-sm font-medium">{availability?.label || "Choose a showing."}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Admin and walk-in sales are marked sold immediately. They are not limited to 8:00 AM–8:00 PM, and they do not close three hours before the show.
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {live.missing || isMissingShowingSetup(live.error) ? <p className="text-sm text-red-900">{showingSetupMessage()}</p> : null}
      <ShowingPicker eventId={data.id} showings={live.showings} basePath={`/events/manage/${data.id}/book`} selectedId={showingId} />
      {data.status === "cancelled" ? <p className="text-sm text-muted">This show is cancelled, so it cannot be booked.</p> : null}
      {layout.error ? (
        <p className="text-sm text-red-900">
          {isMissingSeatTable(layout.error) ? seatSetupMessage() : "The seating layout could not be loaded."}
        </p>
      ) : null}
      {showingId && data.status !== "cancelled" && !layout.error && availability ? (
        <AdminBooker
          eventId={data.id}
          showingId={showingId}
          admissionType={data.admission_type || "seated"}
          initialSections={layout.data.sections}
          ticketPrice={data.ticket_price}
          remaining={availability.remaining || 0}
        />
      ) : null}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Reservation records</h2>
        {records.error ? (
          <p className="text-sm text-red-900">
            {isMissingReservationSetup(records.error) ? reservationSetupMessage() : "Bookings could not be loaded."}
          </p>
        ) : null}
        {!records.error && records.data.length === 0 ? <p className="text-sm text-muted">No bookings yet.</p> : null}
        <ul className="space-y-3">
          {(records.data || []).map((reservation) => (
            <li key={reservation.id} className="rounded-xl border border-line bg-card p-4 text-sm">
              <p className="font-semibold">
                {reservation.customerName || "Customer"} · {reservationSourceLabel(reservation.source)}
              </p>
              <p className="mt-1 text-muted">
                {reservationStatusLabel(reservation.status)} · {formatPeso(reservation.totalAmount)} ·{" "}
                {formatManilaDateTime(reservation.createdAt)}
              </p>
              <p className="mt-1 text-muted">Recorded by {reservation.createdByName || "staff"}</p>
              {reservation.ticketQuantity > 0 ? <p className="mt-1">Tickets: {reservation.ticketQuantity}</p> : null}
              {reservation.items?.length > 0 ? (
                <p className="mt-1">Seats: {reservation.items.map((item) => item.seatLabel).join(", ")}</p>
              ) : null}
              {reservation.customerPhone ? <p className="mt-1">Phone: {reservation.customerPhone}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function BookPage({ params, searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">
        Back to managed events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading booking screen...</p>}>
        <Booker params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
