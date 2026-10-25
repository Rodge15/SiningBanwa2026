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
  return "Seat tables are not ready. Run the Phase 5 SQL migration in the Supabase SQL Editor, then refresh this page.";
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

export function nestLayout(sectionRows, rowRows, seatRows) {
  const sections = (sectionRows || []).map((section) => ({
    id: section.id,
    name: section.name,
    defaultPrice: Number(section.default_price),
    sortOrder: section.sort_order,
    columnCount: section.column_count,
    rows: (rowRows || [])
      .filter((row) => row.section_id === section.id)
      .map((row) => ({
        id: row.id,
        label: row.label,
        sortOrder: row.sort_order,
        seats: (seatRows || [])
          .filter((seat) => seat.row_id === row.id)
          .map((seat) => ({
            id: seat.id,
            label: seat.label,
            colIndex: seat.col_index,
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
      .select("id, name, default_price, sort_order, column_count")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_rows")
      .select("id, section_id, label, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_seats")
      .select("id, row_id, label, col_index, price_override, status")
      .eq("event_id", eventId)
      .order("col_index", { ascending: true }),
  ]);

  const error = sections.error || rows.error || seats.error;

  if (error) {
    return { data: null, error };
  }

  return { data: nestLayout(sections.data, rows.data, seats.data), error: null };
}
