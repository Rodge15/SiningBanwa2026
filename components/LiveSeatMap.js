"use client";

import { useEffect, useState } from "react";
import { SeatMap } from "@/components/SeatMap";
import { POLL_MS } from "@/lib/reservationRules";

function applyAvailability(sections, seats) {
  const byId = new Map((seats || []).map((seat) => [seat.id, seat]));

  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      seats: row.seats.map((seat) => {
        const live = byId.get(seat.id);

        if (!live) {
          return seat;
        }

        return {
          ...seat,
          status: live.status,
          livePrice: live.price,
        };
      }),
    })),
  }));
}

export function LiveSeatMap({
  eventId,
  showingId = "",
  initialSections,
  interactive = false,
  selectedSeatIds = [],
  onBoxClick,
  onSectionsChange,
  selectAvailableOnly = false,
}) {
  const [sections, setSections] = useState(initialSections);

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
        const next = applyAvailability(initialSections, body.seats);

        if (stopped) {
          return;
        }

        setSections(next);
        onSectionsChange?.(next);
      } catch {
        // Keep the last map if one poll fails.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [eventId, showingId, initialSections, onSectionsChange]);

  return (
    <SeatMap
      sections={sections}
      layout="canvas"
      interactive={interactive}
      selectedSeatIds={selectedSeatIds}
      onBoxClick={onBoxClick}
      selectAvailableOnly={selectAvailableOnly}
    />
  );
}
