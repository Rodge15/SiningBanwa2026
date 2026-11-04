import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateEvent, updateEventStatus } from "@/app/actions/events";
import { EventForm } from "@/components/EventForm";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { eventSetupMessage, getVisibleEvent, isMissingEventTable } from "@/lib/events";
import { EVENT_STATUSES, isUuid, statusLabel } from "@/lib/eventRules";
import { getEventLayout } from "@/lib/seats";
import { listShowings } from "@/lib/showingQueries";
import { scheduleFromShowings } from "@/lib/showings";

export const metadata = {
  title: "Edit event | Sining Banwa",
};

async function EditEvent({ params, searchParams }) {
  const { id } = await params;
  await requireRole(EVENT_MANAGER_ROLES);

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

  if (!data) {
    notFound();
  }

  const showings = await listShowings(data.id);
  const schedule = scheduleFromShowings(showings.data);
  const layout = data.admission_type === "general" ? null : await getEventLayout(data.id);
  const layoutMissing = layout && !layout.error && layout.data.sections.every((section) => section.rows.every((row) => row.seats.length === 0));

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Edit event</h1>
        <p className="mt-2 text-sm text-muted">
          Current status: {statusLabel(data.status)}. Saving details does not delete the record.
        </p>
        <div className="mt-4">
          <Suspense fallback={null}>
            <QueryMessage searchParams={searchParams} />
          </Suspense>
          {data.poster_path ? (
            <p className="mb-4">
              <Link href={`/events/${data.id}/poster/view`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/events/${data.id}/poster`}
                  alt=""
                  className="h-48 w-full rounded-xl object-cover"
                />
                <span className="mt-2 inline-block text-sm text-brand hover:underline">View poster</span>
              </Link>
            </p>
          ) : null}
          {layoutMissing ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              The seating layout is not saved. Customers cannot book this seated event until you save it.
            </p>
          ) : null}
          <EventForm action={updateEvent} event={data} schedule={schedule} submitLabel="Save details" />
        </div>
      </div>
      <aside className="h-fit rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{data.admission_type === "general" ? "Tickets" : "Seats"}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {data.admission_type === "general"
            ? "This is general admission. There is no seat map. Set the capacity and ticket price in the event form."
            : "Drag sections, rows, and seats into place. Set a price and tier for each row before bookings open."}
        </p>
        {data.admission_type === "general" ? null : (
          <Link href={`/events/manage/${data.id}/seats`} className={`${buttonClass} mt-4 w-full`}>
            Design seats
          </Link>
        )}
        <Link href={`/events/manage/${data.id}/book`} className={`${buttonClass} mt-4 w-full`}>
          Record a booking
        </Link>
        <h2 className="mt-8 text-lg font-semibold">Status</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Publish makes the event public. Cancel keeps the record and hides it from guests.
        </p>
        <div className="mt-4 grid gap-2">
          {EVENT_STATUSES.map((status) => (
            <form key={status} action={updateEventStatus}>
              <input type="hidden" name="id" value={data.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                disabled={data.status === status}
                className={
                  data.status === status
                    ? "w-full rounded-lg border border-line px-4 py-2 text-sm text-muted"
                    : `${buttonClass} w-full`
                }
              >
                {data.status === status ? `Current: ${statusLabel(status)}` : statusLabel(status)}
              </button>
            </form>
          ))}
        </div>
        {data.status === "published" ? (
          <Link href={`/events/${data.id}`} className="mt-4 inline-block text-sm text-brand hover:underline">
            Open public page
          </Link>
        ) : null}
      </aside>
    </section>
  );
}

export default function EditEventPage({ params, searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">
        Back to managed events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading event...</p>}>
        <EditEvent params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
