"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { POLL_MS } from "@/lib/reservationRules";

export function LiveAvailability({ eventId, showingId = "", initial, reserveHref = "", reserveLabel = "Reserve" }) {
  const [summary, setSummary] = useState(
    initial || { label: "Checking places...", full: false, remaining: null },
  );

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const query = showingId ? `?showing=${showingId}` : "";
        const response = await fetch(`/api/events/${eventId}/availability${query}`, { cache: "no-store" });

        if (!response.ok || stopped) {
          return;
        }

        const body = await response.json();

        if (stopped || !body.label) {
          return;
        }

        setSummary({
          label: body.label,
          full: Boolean(body.full),
          remaining: body.remaining,
          layoutMissing: Boolean(body.layoutMissing),
        });
      } catch {
        // Keep the last count if one poll fails.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [eventId, showingId]);

  return (
    <>
      <p className="text-sm font-medium">{summary.label}</p>
      {summary.layoutMissing ? (
        <p className="text-sm text-muted">No seating layout has been saved for this event yet.</p>
      ) : summary.full ? (
        <p className="text-sm text-muted">This show is Full, so customers cannot reserve it.</p>
      ) : reserveHref ? (
        <p>
          <Link href={reserveHref} className="text-sm text-brand hover:underline">
            {reserveLabel}
          </Link>
        </p>
      ) : null}
    </>
  );
}
