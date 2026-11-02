import { summarizeAudience } from "@/lib/audienceRules";
import { isMissingReservationSetup, releaseExpiredHolds } from "@/lib/reservations";
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
  let reservations = await supabase.rpc("event_ticket_counts", { p_event_ids: ids });

  if (reservations.error && isMissingReservationSetup(reservations.error)) {
    reservations = await supabase.from("reservations").select("event_id, ticket_quantity, status").in("event_id", ids);
  }

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
