import { NextResponse } from "next/server";
import { summarizeAudience } from "@/lib/audienceRules";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent } from "@/lib/events";
import { isMissingReservationSetup, releaseExpiredHolds, reservationSetupMessage } from "@/lib/reservations";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request, { params }) {
  const { id } = await params;

  if (!isUuid(id)) {
    return json({ seats: [] }, 404);
  }

  const event = await getVisibleEvent(id);

  if (event.error || !event.data || event.data.status === "cancelled") {
    return json({ seats: [] }, 404);
  }

  if (event.data.status !== "published") {
    const { profile } = await getCurrentProfile();
    const isManager = profile?.is_active && EVENT_MANAGER_ROLES.includes(profile.role);

    if (!isManager) {
      return json({ seats: [] }, 404);
    }
  }

  const supabase = await createClient();
  const releaseError = await releaseExpiredHolds(supabase);

  if (releaseError) {
    return json({ seats: [], message: "Seat availability could not be refreshed." }, 503);
  }

  const { data, error } = await supabase
    .from("event_seats")
    .select("id, status, price_override, section_id, row_id")
    .eq("event_id", id);

  if (error) {
    return json(
      {
        seats: [],
        message: isMissingReservationSetup(error) ? reservationSetupMessage() : "Seat availability could not be loaded.",
      },
      isMissingReservationSetup(error) ? 503 : 500,
    );
  }

  const [sections, rows] = await Promise.all([
    supabase.from("event_sections").select("id, default_price").eq("event_id", id),
    supabase.from("event_rows").select("id, price").eq("event_id", id),
  ]);

  if (sections.error || rows.error) {
    return json({ seats: [], message: "Seat prices could not be loaded." }, 500);
  }

  const sectionPrices = new Map((sections.data || []).map((section) => [section.id, Number(section.default_price)]));
  const rowPrices = new Map((rows.data || []).map((row) => [row.id, Number(row.price)]));
  const seats = (data || []).map((seat) => ({
    id: seat.id,
    status: seat.status,
    price:
      seat.price_override === null
        ? rowPrices.get(seat.row_id) ?? sectionPrices.get(seat.section_id) ?? null
        : Number(seat.price_override),
    event_id: id,
  }));
  let ticketRows = await supabase.rpc("event_ticket_counts", { p_event_ids: [id] });

  if (ticketRows.error && isMissingReservationSetup(ticketRows.error)) {
    ticketRows = await supabase.from("reservations").select("event_id, ticket_quantity, status").eq("event_id", id);
  }

  const summary = summarizeAudience(event.data, seats, ticketRows.data || []);

  return json({
    seats: seats.map((seat) => ({
      id: seat.id,
      status: seat.status,
      price: seat.price,
    })),
    remaining: summary.remaining,
    full: summary.full,
    label: summary.label,
    serverTime: new Date().toISOString(),
  });
}
