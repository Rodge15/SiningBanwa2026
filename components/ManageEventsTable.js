"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteEvent } from "@/app/actions/events";
import { fieldClass } from "@/components/formStyles";
import { EVENT_STATUSES, formatManilaDateTime, statusLabel } from "@/lib/eventRules";

export function ManageEventsTable({ events }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (events || []).filter((event) => {
      const matchesStatus = statusFilter === "all" || event.status === statusFilter;
      const haystack = `${event.title || ""} ${event.venue || ""}`.toLowerCase();
      const matchesQuery = needle === "" || haystack.includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [events, query, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or venue"
          className={`${fieldClass} sm:max-w-xs`}
          aria-label="Search events"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={`${fieldClass} sm:max-w-[12rem]`}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
          No events match your search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Places left</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{event.title}</td>
                  <td className="px-4 py-3">{formatManilaDateTime(event.starts_at)}</td>
                  <td className="px-4 py-3">
                    <span>{event.availability?.label || "Not ready"}</span>
                    {event.availability && !event.availability.layoutMissing && event.availability.capacity > 0 ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {event.availability.booked ?? 0} booked / {event.availability.capacity} total
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{statusLabel(event.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/events/manage/${event.id}`} className="text-brand hover:underline">
                        Edit
                      </Link>
                      {event.admission_type === "general" ? (
                        <span className="text-muted">No seat map</span>
                      ) : (
                        <Link href={`/events/manage/${event.id}/seats`} className="text-brand hover:underline">
                          Seats
                        </Link>
                      )}
                      <form
                        action={deleteEvent}
                        onSubmit={(submitEvent) => {
                          if (
                            !window.confirm(
                              `Delete "${event.title}"? This permanently removes the event and all of its seats, showings, and bookings. This cannot be undone.`,
                            )
                          ) {
                            submitEvent.preventDefault();
                          }
                        }}
                        className="inline"
                      >
                        <input type="hidden" name="id" value={event.id} />
                        <button type="submit" className="text-red-700 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}