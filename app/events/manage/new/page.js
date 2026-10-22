import Link from "next/link";
import { Suspense } from "react";
import { createEvent } from "@/app/actions/events";
import { EventForm } from "@/components/EventForm";
import { QueryMessage } from "@/components/QueryMessage";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";

export const metadata = {
  title: "New event | Sining Banwa",
};

async function NewEventForm({ searchParams }) {
  await requireRole(EVENT_MANAGER_ROLES);

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">New event</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        This saves a draft. Guests cannot see it until you publish it. The start time is Philippine
        time.
      </p>
      <div className="mt-4">
        <Suspense fallback={null}>
          <QueryMessage searchParams={searchParams} />
        </Suspense>
        <EventForm action={createEvent} submitLabel="Save draft" />
      </div>
    </section>
  );
}

export default function NewEventPage({ searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">
        Back to managed events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Checking event access...</p>}>
        <NewEventForm searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
