import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eventSetupMessage, getVisibleEvent, isMissingEventTable } from "@/lib/events";
import { formatManilaDateTime, isUuid } from "@/lib/eventRules";
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

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      {data.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/events/${data.id}/poster`} alt="" className="max-h-96 w-full object-cover" />
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
