import { summarizeAudience, summarizeShowing } from "@/lib/audienceRules";
import { isMissingReservationSetup, releaseExpiredHolds } from "@/lib/reservations";
import { isMissingShowingSetup } from "@/lib/showings";
import { createClient } from "@/lib/supabase/server";

export { summarizeAudience };

export async function attachAudience(events) {
  if (!events?.length) {
    return { events: events || [], error: null };
  }

  const supabase = await createClient();
  await releaseExpiredHolds(supabase);
  const ids = events.map((event) => event.id);
  const seats = await supabase.from("event_seats").select("event_id, status").in("event_id", ids);
  const showings = await supabase.from("showings").select("id, event_id, starts_at, capacity").in("event_id", ids);
  let reservations = await supabase
    .from("reservations")
    .select("event_id, showing_id, ticket_quantity, status")
    .in("event_id", ids);

  if (reservations.error && isMissingShowingSetup(reservations.error)) {
    reservations = await supabase.rpc("event_ticket_counts", { p_event_ids: ids });
  }

  if (reservations.error && isMissingReservationSetup(reservations.error)) {
    reservations = await supabase.from("reservations").select("event_id, ticket_quantity, status").in("event_id", ids);
  }

  const error = seats.error || reservations.error || (showings.error && !isMissingShowingSetup(showings.error) ? showings.error : null);

  if (error) {
    return { events, error };
  }

  const showingRows = showings.error ? [] : showings.data || [];
  let showingSeats = { data: [] };

  if (showingRows.length) {
    showingSeats = await supabase.from("showing_seats").select("showing_id, status").in(
      "showing_id",
      showingRows.map((showing) => showing.id),
    );
  }

  return {
    events: events.map((event) => {
      const eventShowings = showingRows.filter((showing) => showing.event_id === event.id);

      if (!eventShowings.length) {
        return {
          ...event,
          availability: summarizeAudience(event, seats.data, reservations.data),
        };
      }

      const summaries = eventShowings.map((showing) => ({
        id: showing.id,
        startsAt: showing.starts_at,
        ...summarizeShowing({
          admissionType: event.admission_type,
          capacity: showing.capacity,
          seats: (showingSeats.data || []).filter((seat) => seat.showing_id === showing.id),
          ticketQuantity: (reservations.data || [])
            .filter((item) => item.showing_id === showing.id && item.event_id === event.id)
            .reduce((total, item) => total + Number(item.ticket_quantity || 0), 0),
        }),
      }));
      const layoutMissing = summaries.every((item) => item.layoutMissing);
      const full = summaries.every((item) => item.full) && !layoutMissing;

      return {
        ...event,
        availability: {
          remaining: summaries.reduce((total, item) => total + item.remaining, 0),
          full,
          layoutMissing,
          label: layoutMissing ? "No seats saved" : full ? "Full" : `${summaries.length} showtimes`,
          showings: summaries,
        },
      };
    }),
    error: null,
  };
}
