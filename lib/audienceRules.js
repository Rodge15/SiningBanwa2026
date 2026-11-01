const HELD_STATUSES = ["pending", "awaiting_payment", "payment_verification", "confirmed"];

export function summarizeAudience(event, seats, reservations) {
  const capacity = Number(event.audience_capacity || 0);
  const seated = event.admission_type !== "general";
  const eventSeats = (seats || []).filter((seat) => seat.event_id === event.id);
  const taken = seated
    ? eventSeats.filter((seat) => seat.status !== "available").length
    : (reservations || [])
        .filter((item) => item.event_id === event.id && HELD_STATUSES.includes(item.status))
        .reduce((total, item) => total + Number(item.ticket_quantity || 0), 0);
  const available = seated ? eventSeats.filter((seat) => seat.status === "available").length : Math.max(capacity - taken, 0);
  const noMapYet = seated && eventSeats.length === 0;

  return {
    seated,
    capacity,
    remaining: available,
    full: available <= 0,
    label: noMapYet ? "No seats yet" : available <= 0 ? "Full" : seated ? `${available} seats left` : `${available} tickets left`,
  };
}
