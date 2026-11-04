import { releaseExpiredHolds } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

export function isMissingSeatTable(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST202" ||
    /schema cache|does not exist|could not find the table|save_event_layout/i.test(message)
  );
}

export function seatSetupMessage() {
  return "Seat layout columns are not ready. In the Supabase SQL Editor, run supabase/migrations/20261026120000_seat_tiers_and_admission.sql once, then refresh. If the Phase 5 or Phase 6 file was never run, run those first.";
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

export function nestLayout(sectionRows, rowRows, seatRows) {
  const sections = (sectionRows || []).map((section, sectionIndex) => ({
    id: section.id,
    name: section.name,
    defaultPrice: Number(section.default_price),
    tier: section.tier || "regular",
    sortOrder: section.sort_order,
    columnCount: section.column_count,
    posX: Number.isInteger(section.pos_x) ? section.pos_x : 40,
    posY: Number.isInteger(section.pos_y) ? section.pos_y : 40 + sectionIndex * 180,
    rows: (rowRows || [])
      .filter((row) => row.section_id === section.id)
      .map((row, rowIndex) => ({
        id: row.id,
        label: row.label,
        tier: row.tier || section.tier || "regular",
        price: money(row.price) ?? Number(section.default_price),
        sortOrder: row.sort_order,
        posX: Number.isInteger(row.pos_x) ? row.pos_x : 56,
        posY: Number.isInteger(row.pos_y) ? row.pos_y : 88 + rowIndex * 72,
        seats: (seatRows || [])
          .filter((seat) => seat.row_id === row.id)
          .map((seat) => ({
            id: seat.id,
            label: seat.label,
            colIndex: seat.col_index,
            posX: Number.isInteger(seat.pos_x) ? seat.pos_x : 56 + seat.col_index * 92,
            posY: Number.isInteger(seat.pos_y) ? seat.pos_y : 116 + rowIndex * 72,
            priceOverride: money(seat.price_override),
            status: seat.status,
          })),
      })),
  }));

  return { sections };
}

export async function getEventLayout(eventId) {
  const supabase = await createClient();
  await releaseExpiredHolds(supabase);
  const [sections, rows, seats] = await Promise.all([
    supabase
      .from("event_sections")
      .select("id, name, default_price, tier, sort_order, column_count, pos_x, pos_y")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_rows")
      .select("id, section_id, label, tier, price, sort_order, pos_x, pos_y")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_seats")
      .select("id, row_id, label, col_index, pos_x, pos_y, price_override, status")
      .eq("event_id", eventId)
      .order("col_index", { ascending: true }),
  ]);

  const error = sections.error || rows.error || seats.error;

  if (error) {
    return { data: null, error };
  }

  const showings = await supabase.from("showings").select("id").eq("event_id", eventId);
  const seatRows = seats.data || [];

  if (!showings.error && showings.data?.length) {
    const runtime = await supabase
      .from("showing_seats")
      .select("seat_id, status")
      .in("showing_id", showings.data.map((showing) => showing.id));
    const rank = { available: 0, blocked: 1, locked: 2, reserved: 3, sold: 4 };
    const strongest = new Map();

    for (const row of runtime.data || []) {
      const current = strongest.get(row.seat_id);

      if (!current || (rank[row.status] || 0) > (rank[current] || 0)) {
        strongest.set(row.seat_id, row.status);
      }
    }

    for (const seat of seatRows) {
      if (strongest.has(seat.id)) {
        seat.status = strongest.get(seat.id);
      }
    }
  }

  return { data: nestLayout(sections.data, rows.data, seatRows), error: null };
}
