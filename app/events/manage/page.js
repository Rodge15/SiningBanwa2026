import Link from "next/link";
import { Suspense } from "react";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES, roleLabel } from "@/lib/roles";
import { eventSetupMessage, isMissingEventTable, listManagedEvents } from "@/lib/events";
import { formatManilaDateTime, statusLabel } from "@/lib/eventRules";

export const metadata = {
  title: "Manage events | Sining Banwa",
};

async function ManageEvents({ searchParams }) {
  const { profile } = await requireRole(EVENT_MANAGER_ROLES);

  const { data, error } = await listManagedEvents();

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
          {isMissingEventTable(error) ? eventSetupMessage() : "Events could not be loaded."}
        </p>
      ) : null}
      {!error && data?.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
          No events yet. Create a draft, then publish it when it should be public.
        </p>
      ) : null}
      {data?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((event) => (
                <tr key={event.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{event.title}</td>
                  <td className="px-4 py-3">{formatManilaDateTime(event.starts_at)}</td>
                  <td className="px-4 py-3">{statusLabel(event.status)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/events/manage/${event.id}`} className="text-brand hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
