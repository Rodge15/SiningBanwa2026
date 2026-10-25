import { NextResponse } from "next/server";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent } from "@/lib/events";
import { isMissingReservationSetup, releaseExpiredHolds, reservationSetupMessage } from "@/lib/reservations";
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

  if (event.error || !event.data || event.data.status !== "published") {
    return json({ seats: [] }, 404);
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

  return json({
    seats: (data || []).map((seat) => ({
      id: seat.id,
      status: seat.status,
      price:
        seat.price_override === null
          ? rowPrices.get(seat.row_id) ?? sectionPrices.get(seat.section_id) ?? null
          : Number(seat.price_override),
    })),
    serverTime: new Date().toISOString(),
  });
}
