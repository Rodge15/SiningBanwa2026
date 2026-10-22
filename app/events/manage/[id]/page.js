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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/events/${data.id}/poster`}
                        alt=""
                        className="mb-4 h-48 w-full rounded-xl object-cover"
                      />
                    ) : null}
          <EventForm action={updateEvent} event={data} submitLabel="Save details" />
        </div>
      </div>
      <aside className="h-fit rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Status</h2>
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
