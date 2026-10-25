import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { saveSeatLayout } from "@/app/actions/seats";
import { QueryMessage } from "@/components/QueryMessage";
import { SeatDesigner } from "@/components/SeatDesigner";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent, isMissingEventTable, eventSetupMessage } from "@/lib/events";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { getEventLayout, isMissingSeatTable, seatSetupMessage } from "@/lib/seats";

export const metadata = {
  title: "Design seats | Sining Banwa",
};

async function Designer({ params, searchParams }) {
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

  if (data.admission_type === "general") {
    return (
      <div className="space-y-3">
        <Link href={`/events/manage/${data.id}`} className="text-sm text-brand hover:underline">
          Back to event editor
        </Link>
        <h1 className="text-3xl font-semibold">No seat map</h1>
        <p className="text-sm text-muted">
          {data.title} is general admission. Customers reserve a number of tickets. The capacity and ticket price are
          on the event form.
        </p>
      </div>
    );
  }

  const layout = await getEventLayout(id);

  if (layout.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {isMissingSeatTable(layout.error) ? seatSetupMessage() : "The seating layout could not be loaded."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/events/manage/${data.id}`} className="text-sm text-brand hover:underline">
          Back to event editor
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
        <h1 className="mt-1 text-3xl font-semibold">Design seats</h1>
        <p className="mt-2 text-sm text-muted">
          {data.title}. Drag a section, row, or seat on the canvas. Set each row&apos;s tier and price. A booked or
          sold seat cannot be moved. Save, then refresh to confirm the same positions and colors.
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      <SeatDesigner eventId={data.id} initialLayout={layout.data} action={saveSeatLayout} />
    </div>
  );
}

export default function SeatDesignerPage({ params, searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">
        Back to managed events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading seat designer...</p>}>
        <Designer params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
