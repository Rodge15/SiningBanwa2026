import Link from "next/link";
import { Suspense } from "react";
import { ManageEventsTable } from "@/components/ManageEventsTable";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES, roleLabel } from "@/lib/roles";
import { attachAudience } from "@/lib/audience";
import { eventLoadMessage, listManagedEvents } from "@/lib/events";

export const metadata = {
  title: "Manage events | Sining Banwa",
};

async function ManageEvents({ searchParams }) {
  const { profile } = await requireRole(EVENT_MANAGER_ROLES);

  const listed = await listManagedEvents();
  const audience = listed.error ? { events: listed.data, error: listed.error } : await attachAudience(listed.data);
  const data = audience.events;
  const error = listed.error || audience.error;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
          <h1 className="mt-1 text-3xl font-semibold">Manage events</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as {roleLabel(profile.role)}. New events start as drafts.
          </p>
        </div>
        <Link href="/events/manage/new" className={buttonClass}>
          New event
        </Link>
      </div>
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
          No events yet. Create a draft, then publish it when it should be public.
        </p>
      ) : null}
      {data?.length ? <ManageEventsTable events={data} /> : null}
    </section>
  );
}

export default function ManageEventsPage({ searchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Checking event access...</p>}>
      <ManageEvents searchParams={searchParams} />
    </Suspense>
  );
}