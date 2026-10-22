import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/EventCard";
import { buttonClass } from "@/components/formStyles";
import { eventSetupMessage, isMissingEventTable, listPublishedEvents } from "@/lib/events";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

async function HomeEvents() {
  if (!getPublicSupabaseEnv().configured) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Supabase is not connected yet. Add your project URL and keys to <code>.env.local</code>, then
        restart the dev server.
      </p>
    );
  }

  const { data, error } = await listPublishedEvents();

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {isMissingEventTable(error) ? eventSetupMessage() : "Published events could not be loaded."}
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
        No published events yet. Draft, completed, and cancelled events stay hidden.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((event) => (
        <EventCard key={event.id} event={event} href={`/events/${event.id}`} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Thesis prototype</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
          Sining Banwa event system
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          Browse published Sining Banwa events, or create an account to sign in. Seats, payments, and
          tickets come in later phases.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/events" className={buttonClass}>
            Browse events
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
          >
            Log in
          </Link>
        </div>
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Published events</h2>
          <p className="mt-1 text-sm text-muted">
            Guests can open these without logging in.{" "}
            <Link href="/events" className="text-brand hover:underline">
              See the full list
            </Link>
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">Loading published events...</p>}>
          <HomeEvents />
        </Suspense>
      </section>
    </div>
  );
}
