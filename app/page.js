import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventCard } from "@/components/EventCard";
import { buttonClass } from "@/components/formStyles";
import { attachAudience } from "@/lib/audience";
import { getCurrentUser } from "@/lib/auth";
import { eventLoadMessage, listPublishedEvents } from "@/lib/events";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

const outlineButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand";

async function HeroActions() {
  // Reads the session per request, so this part is dynamic.
  await connection();

  let user = null;

  if (getPublicSupabaseEnv().configured) {
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
  }

  if (user) {
    return (
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/events" className={buttonClass}>
          Browse events
        </Link>
        <Link href="/account/reservations" className={outlineButtonClass}>
          My reservations
        </Link>
        <Link href="/account" className={outlineButtonClass}>
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link href="/events" className={buttonClass}>
        Browse events
      </Link>
      <Link href="/signup" className={outlineButtonClass}>
        Create an account
      </Link>
      <Link href="/login" className={outlineButtonClass}>
        Log in
      </Link>
    </div>
  );
}

async function HomeEvents() {
  // Published events are read live from Supabase per request, so this part is
  // dynamic, not prerendered.
  await connection();

  if (!getPublicSupabaseEnv().configured) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Supabase is not connected yet. Add your project URL and keys to <code>.env.local</code>, then
        restart the dev server.
      </p>
    );
  }

  const listed = await listPublishedEvents();

  if (listed.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {eventLoadMessage(listed.error)}
      </p>
    );
  }

  // Seat-count availability is a best-effort enrichment. If it fails, still show
  // the events (without the count pills) instead of blanking the whole list.
  const audience = await attachAudience(listed.data);
  const data = audience.events || listed.data;

  if (!data?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
        No published events yet. Draft, completed, and cancelled events stay hidden.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
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
          Browse published Sining Banwa events and hold seats for the shows you want.
        </p>
        <Suspense
          fallback={
            <div className="mt-6">
              <Link href="/events" className={buttonClass}>
                Browse events
              </Link>
            </div>
          }
        >
          <HeroActions />
        </Suspense>
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