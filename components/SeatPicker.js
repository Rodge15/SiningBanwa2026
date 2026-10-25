"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { createReservation } from "@/app/actions/reservations";
import { LiveSeatMap } from "@/components/LiveSeatMap";
import { buttonClass } from "@/components/formStyles";
import { effectivePrice, formatPeso } from "@/lib/seatRules";
import { MAX_SEATS_PER_RESERVATION } from "@/lib/reservationRules";

function listedSeats(sections) {
  const seats = [];

  for (const section of sections || []) {
    for (const row of section.rows || []) {
      for (const seat of row.seats || []) {
        seats.push({ section, seat });
      }
    }
  }

  return seats;
}

function shownPrice(section, seat) {
  if (seat.livePrice == null || Number.isNaN(Number(seat.livePrice))) {
    return effectivePrice(seat, section);
  }

  return Number(seat.livePrice);
}

export function SeatPicker({ eventId, initialSections, canReserve, signedIn = false, loginHref = "/login" }) {
  const [sections, setSections] = useState(initialSections);
  const [selected, setSelected] = useState([]);

  const onSectionsChange = useCallback((next) => {
    setSections(next);
    const available = new Set(
      listedSeats(next)
        .filter(({ seat }) => seat.status === "available")
        .map(({ seat }) => seat.id),
    );
    setSelected((current) => current.filter((id) => available.has(id)));
  }, []);

  function toggle(box) {
    if (!canReserve || !box.seat || box.seat.status !== "available") {
      return;
    }

    setSelected((current) => {
      if (current.includes(box.seat.id)) {
        return current.filter((id) => id !== box.seat.id);
      }

      if (current.length >= MAX_SEATS_PER_RESERVATION) {
        return current;
      }

      return [...current, box.seat.id];
    });
  }

  const chosen = useMemo(() => {
    const byId = new Map(listedSeats(sections).map(({ section, seat }) => [seat.id, { section, seat }]));
    return selected.map((id) => byId.get(id)).filter(Boolean);
  }, [sections, selected]);

  const estimate = chosen.reduce((total, item) => total + shownPrice(item.section, item.seat), 0);

  return (
    <div className="space-y-4">
      <LiveSeatMap
        eventId={eventId}
        initialSections={initialSections}
        interactive={canReserve}
        selectAvailableOnly
        selectedSeatIds={selected}
        onBoxClick={toggle}
        onSectionsChange={onSectionsChange}
      />
      <div className="rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Selected seats</h2>
        {chosen.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Click available seats. You can hold up to {MAX_SEATS_PER_RESERVATION}.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {chosen.map(({ section, seat }) => (
              <li key={seat.id}>
                {seat.label} · {section.name} · {formatPeso(shownPrice(section, seat))}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          Estimate {formatPeso(estimate)}. The server calculates the real total from the saved seat prices.
        </p>
        {canReserve ? (
          <form action={createReservation} className="mt-4">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="seatIds" value={JSON.stringify(selected)} />
            <button type="submit" className={buttonClass} disabled={chosen.length === 0}>
              Hold these seats
            </button>
          </form>
        ) : signedIn ? (
          <p className="mt-3 text-sm text-muted">Only an active customer account can hold seats.</p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            <Link href={loginHref} className="text-brand hover:underline">
              Log in
            </Link>{" "}
            with a customer account to hold seats.
          </p>
        )}
      </div>
    </div>
  );
}
