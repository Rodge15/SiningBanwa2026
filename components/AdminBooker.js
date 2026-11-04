"use client";

import { useCallback, useMemo, useState } from "react";
import { createStaffReservation, searchBookingCustomers } from "@/app/actions/reservations";
import { LiveSeatMap } from "@/components/LiveSeatMap";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { effectivePrice, formatPeso } from "@/lib/seatRules";
import { MAX_STAFF_SEATS } from "@/lib/reservationRules";

function listedSeats(sections) {
  const seats = [];

  for (const section of sections || []) {
    for (const row of section.rows || []) {
      for (const seat of row.seats || []) {
        seats.push({ section, row, seat });
      }
    }
  }

  return seats;
}

export function AdminBooker({ eventId, showingId, admissionType, initialSections, ticketPrice, remaining }) {
  const [sections, setSections] = useState(initialSections || []);
  const [selected, setSelected] = useState([]);
  const [source, setSource] = useState("walk_in");
  const [mode, setMode] = useState("new");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const general = admissionType === "general";
  const maxTickets = Math.min(MAX_STAFF_SEATS, Math.max(remaining || 0, 1));

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
    if (!box.seat || box.seat.status !== "available") {
      return;
    }

    setSelected((current) => {
      if (current.includes(box.seat.id)) {
        return current.filter((id) => id !== box.seat.id);
      }

      if (current.length >= MAX_STAFF_SEATS) {
        return current;
      }

      return [...current, box.seat.id];
    });
  }

  const chosen = useMemo(() => {
    const byId = new Map(listedSeats(sections).map(({ section, row, seat }) => [seat.id, { section, row, seat }]));
    return selected.map((id) => byId.get(id)).filter(Boolean);
  }, [sections, selected]);

  const estimate = general
    ? Number(ticketPrice || 0) * quantity
    : chosen.reduce((total, item) => total + effectivePrice(item.seat, item.section, item.row), 0);

  async function lookup(event) {
    event.preventDefault();
    const result = await searchBookingCustomers(query);
    setMatches(result.matches || []);
    setSearchMessage(result.message || (result.matches?.length ? "" : "No matching customer account."));
  }

  return (
    <div className="space-y-4">
      {general ? (
        <p className="text-sm text-muted">
          This show has no seat map. Each ticket is {formatPeso(ticketPrice)}. Places left: {remaining}.
        </p>
      ) : (
        <LiveSeatMap
          eventId={eventId}
          showingId={showingId}
          initialSections={initialSections}
          interactive
          selectAvailableOnly
          selectedSeatIds={selected}
          onBoxClick={toggle}
          onSectionsChange={onSectionsChange}
        />
      )}
      <form onSubmit={lookup} className="rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Existing customer</h2>
        <p className="mt-1 text-sm text-muted">Search by name, email, or phone. Leave this blank if the person has no account.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={fieldClass}
            placeholder="Name, email, or phone"
            aria-label="Search customers"
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </div>
        {searchMessage ? <p className="mt-2 text-sm text-muted">{searchMessage}</p> : null}
        {matches.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {matches.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="text-left text-brand hover:underline"
                  onClick={() => {
                    setMode("existing");
                    setCustomerId(customer.id);
                    setSearchMessage(customer.full_name || customer.email);
                  }}
                >
                  {customer.full_name || "No name"} · {customer.email}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      <form action={createStaffReservation} className="space-y-3 rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Record the sale</h2>
        <p className="text-sm text-muted">
          This marks the seats or tickets sold now. It does not use the five-minute hold, and it is not limited to the online booking hours.
        </p>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="showingId" value={showingId} />
        <input type="hidden" name="admissionType" value={admissionType} />
        <input type="hidden" name="customerMode" value={mode} />
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="seatIds" value={JSON.stringify(selected)} />
        <label className="block text-sm font-medium" htmlFor="source">
          Source
        </label>
        <select id="source" name="source" value={source} onChange={(event) => setSource(event.target.value)} className={fieldClass}>
          <option value="walk_in">Walk-in</option>
          <option value="admin">Admin</option>
        </select>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Customer</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
            Use the selected account{customerId ? "" : " (search above first)"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === "new"}
              onChange={() => {
                setMode("new");
                setCustomerId("");
              }}
            />
            Enter name and contact details
          </label>
        </fieldset>
        {mode === "new" ? (
          <div className="grid gap-3">
            <label className="text-sm font-medium" htmlFor="customerName">
              Name
              <input id="customerName" name="customerName" className={fieldClass} required />
            </label>
            <label className="text-sm font-medium" htmlFor="customerPhone">
              Phone
              <input id="customerPhone" name="customerPhone" className={fieldClass} required />
            </label>
            <label className="text-sm font-medium" htmlFor="customerEmail">
              Email, optional
              <input id="customerEmail" name="customerEmail" type="email" className={fieldClass} />
            </label>
          </div>
        ) : (
          <p className="text-sm">{customerId ? "A customer account is selected." : "Search and choose a customer account."}</p>
        )}
        {general ? (
          <label className="block text-sm font-medium" htmlFor="quantity">
            Tickets
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={maxTickets}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className={fieldClass}
            />
          </label>
        ) : (
          <input type="hidden" name="quantity" value="0" />
        )}
        {!general && chosen.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {chosen.map(({ section, row, seat }) => (
              <li key={seat.id}>
                {seat.label} · {section.name} · {formatPeso(effectivePrice(seat, section, row))}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm">Estimate {formatPeso(estimate)}. The server uses the saved prices.</p>
        <button
          type="submit"
          className={buttonClass}
          disabled={general ? remaining <= 0 : chosen.length === 0}
        >
          Mark sold
        </button>
      </form>
    </div>
  );
}
