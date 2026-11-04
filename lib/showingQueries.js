import { createClient } from "@/lib/supabase/server";
import { summarizeShowing } from "@/lib/audienceRules";
import { isMissingShowingSetup } from "@/lib/showings";

const HELD = ["pending", "awaiting_payment", "payment_verification", "confirmed", "rejected"];

export async function listShowings(eventId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("showings")
    .select("id, event_id, starts_at, capacity")
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true });

  return { data: data || [], error };
}

export async function showingAvailability(event, showingId) {
  const supabase = await createClient();
  const showings = await listShowings(event.id);

  if (showings.error && isMissingShowingSetup(showings.error)) {
    return { missing: true, showings: [], selected: null, seats: [] };
  }

  if (showings.error) {
    return { error: showings.error, showings: [], selected: null, seats: [] };
  }

  const selected = showings.data.find((showing) => showing.id === showingId) || null;
  const reservations = await supabase
    .from("reservations")
    .select("showing_id, ticket_quantity, status")
    .eq("event_id", event.id)
    .in("status", HELD);

  let showingSeats = { data: [], error: null };

  if (event.admission_type !== "general" && showings.data.length) {
    showingSeats = await supabase
      .from("showing_seats")
      .select("showing_id, seat_id, status")
      .in("showing_id", showings.data.map((showing) => showing.id));
  }

  const ticketsByShowing = new Map();

  for (const row of reservations.data || []) {
    ticketsByShowing.set(row.showing_id, (ticketsByShowing.get(row.showing_id) || 0) + Number(row.ticket_quantity || 0));
  }

  const summaries = showings.data.map((showing) => {
    const seats = (showingSeats.data || []).filter((seat) => seat.showing_id === showing.id);
    const summary = summarizeShowing({
      admissionType: event.admission_type,
      capacity: showing.capacity,
      seats,
      ticketQuantity: ticketsByShowing.get(showing.id) || 0,
    });

    return {
      id: showing.id,
      startsAt: showing.starts_at,
      capacity: showing.capacity,
      ...summary,
    };
  });

  const selectedSummary = summaries.find((showing) => showing.id === selected?.id) || null;
  const seats = selected
    ? (showingSeats.data || [])
        .filter((seat) => seat.showing_id === selected.id)
        .map((seat) => ({ id: seat.seat_id, status: seat.status }))
    : [];

  return {
    showings: summaries,
    selected: selectedSummary,
    seats,
    error: reservations.error || showingSeats.error,
  };
}
