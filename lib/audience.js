import { releaseExpiredHolds } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

const HELD_STATUSES = ["pending", "awaiting_payment", "payment_verification", "confirmed"];

export function summarizeAudience(event, seats, reservations) {
  const capacity = Number(event.audience_capacity || 0);
  const seated = event.admission_type !== "general";
  const taken = seated
    ? (seats || []).filter((seat) => seat.event_id === event.id && seat.status !== "available").length
    : (reservations || [])
        .filter((item) => item.event_id === event.id && HELD_STATUSES.includes(item.status))
        .reduce((total, item) => total + Number(item.ticket_quantity || 0), 0);
  const available = seated
    ? (seats || []).filter((seat) => seat.event_id === event.id && seat.status === "available").length
    : Math.max(capacity - taken, 0);

  return {
    seated,
    capacity,
    remaining: available,
    full: available <= 0,
    label: available <= 0 ? "Full" : seated ? `${available} seats left` : `${available} tickets left`,
  };
}

export async function attachAudience(events) {
  if (!events?.length) {
    return { events: events || [], error: null };
  }

  const supabase = await createClient();
  await releaseExpiredHolds(supabase);
  const ids = events.map((event) => event.id);
  const [seats, reservations] = await Promise.all([
    supabase.from("event_seats").select("event_id, status").in("event_id", ids),
    supabase.from("reservations").select("event_id, ticket_quantity, status").in("event_id", ids),
  ]);
  const error = seats.error || reservations.error;

  if (error) {
    return { events, error };
  }

  return {
    events: events.map((event) => ({
      ...event,
      availability: summarizeAudience(event, seats.data, reservations.data),
    })),
    error: null,
  };
}
