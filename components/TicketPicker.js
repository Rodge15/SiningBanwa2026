"use client";

import Link from "next/link";
import { useState } from "react";
import { createGeneralAdmissionReservation } from "@/app/actions/reservations";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { formatPeso } from "@/lib/seatRules";
import { MAX_SEATS_PER_RESERVATION } from "@/lib/reservationRules";

export function TicketPicker({
  eventId,
  showingId,
  ticketPrice,
  remaining,
  canReserve,
  signedIn = false,
  loginHref = "/login",
  blockedMessage = "",
}) {
  const [quantity, setQuantity] = useState(1);
  const full = remaining <= 0;
  const max = Math.min(MAX_SEATS_PER_RESERVATION, Math.max(remaining, 0));

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h2 className="text-lg font-semibold">Tickets</h2>
      <p className="mt-2 text-sm text-muted">This show has no seat map. Each ticket is {formatPeso(ticketPrice)}.</p>
      <p className="mt-2 text-sm font-medium">{full ? "Full" : `${remaining} tickets left`}</p>
      {canReserve && !full ? (
        <form action={createGeneralAdmissionReservation} className="mt-4 space-y-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="showingId" value={showingId} />
          <label htmlFor="quantity" className="text-sm font-medium">
            Number of tickets
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={max}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className={fieldClass}
          />
          <p className="text-sm">Estimate {formatPeso(Number(ticketPrice) * quantity)}. The server uses the saved ticket price.</p>
          <button type="submit" className={buttonClass}>
            Hold these tickets
          </button>
        </form>
      ) : null}
      {full ? <p className="mt-3 text-sm text-muted">This show is full, so it cannot be reserved.</p> : null}
      {!canReserve && !full ? (
        blockedMessage ? (
          <p className="mt-3 text-sm text-muted">{blockedMessage}</p>
        ) : signedIn ? (
          <p className="mt-3 text-sm text-muted">Only an active customer account can hold tickets.</p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            <Link href={loginHref} className="text-brand hover:underline">
              Log in
            </Link>{" "}
            with a customer account to hold tickets.
          </p>
        )
      ) : null}
    </div>
  );
}
