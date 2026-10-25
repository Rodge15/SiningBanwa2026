import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/EventCard";
import { QueryMessage } from "@/components/QueryMessage";
import { attachAudience } from "@/lib/audience";
import { eventLoadMessage, listPublishedEvents } from "@/lib/events";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const metadata = {
  title: "Events | Sining Banwa",
};

async function PublishedEvents({ searchParams }) {
  if (!getPublicSupabaseEnv().configured) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Supabase is not connected yet. Add the project URL and keys to <code>.env.local</code>, then
        restart the dev server.
      </p>
    );
  }

  const listed = await listPublishedEvents();
  const audience = listed.error ? { events: listed.data, error: listed.error } : await attachAudience(listed.data);
  const data = audience.events;
  const error = listed.error || audience.error;

  return (
    <>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {eventLoadMessage(error)}
        </p>
      ) : null}
      {!error && data?.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
          No published events yet. Draft, completed, and cancelled events stay hidden here.
        </p>
      ) : null}
      <div className="grid gap-4">
        {data?.map((event) => (
          <EventCard key={event.id} event={event} href={`/events/${event.id}`} />
        ))}
      </div>
    </>
  );
}

export default function EventsPage({ searchParams }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Public events</p>
        <h1 className="mt-1 text-3xl font-semibold">Sining Banwa events</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted">
          Only published events are listed. Open an event to see seats and hold available ones.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading published events...</p>}>
        <PublishedEvents searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        Staff can manage events after logging in.{" "}
        <Link href="/events/manage" className="text-brand hover:underline">
          Open event management
        </Link>
      </p>
    </section>
  );
}
