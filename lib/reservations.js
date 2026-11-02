import { createClient } from "@/lib/supabase/server";

export function isMissingReservationSetup(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|could not find the (table|function)|release_expired_seat_holds|create_online_reservation|cancel_online_reservation|create_staff_reservation|event_ticket_counts|online_sales_closed_reason|customer_name/i.test(
      message,
    )
  );
}

export function reservationSetupMessage() {
  return "Reservation setup is not ready. In the Supabase SQL Editor, run the Phase 6 file if needed, then 20261026120000, then supabase/migrations/20261027120000_booking_rules_and_admin_bookings.sql once. Refresh after it succeeds. Do not drop tables.";
}

export async function releaseExpiredHolds(supabase) {
  const { error } = await supabase.rpc("release_expired_seat_holds");

  if (!error || isMissingReservationSetup(error)) {
    return null;
  }

  return error;
}

function mapItem(item) {
  return {
    id: item.id,
    seatId: item.seat_id,
    seatLabel: item.seat_label,
    unitPrice: Number(item.unit_price),
    releasedAt: item.released_at,
  };
}

function mapReservation(row, items = []) {
  return {
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    totalAmount: Number(row.total_amount),
    source: row.source,
    eventTitle: row.event_title,
    holdExpiresAt: row.hold_expires_at,
    paymentSubmittedAt: row.payment_submitted_at,
    createdAt: row.created_at,
    ticketQuantity: Number(row.ticket_quantity || 0),
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    createdByName: row.created_by_name || "",
    items: items.map(mapItem),
  };
}

export async function listEventReservations(eventId) {
  const supabase = await createClient();
  await releaseExpiredHolds(supabase);

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, status, total_amount, source, created_at, ticket_quantity, customer_name, customer_phone, created_by_name, reservation_items(seat_label, released_at)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data || []).map((row) => ({
      ...mapReservation(row, row.reservation_items || []),
      items: (row.reservation_items || [])
        .filter((item) => !item.released_at)
        .map((item) => ({ seatLabel: item.seat_label })),
    })),
    error: null,
  };
}

export async function listMyReservations(userId) {
  const supabase = await createClient();
  await releaseExpiredHolds(supabase);

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, event_id, status, total_amount, source, event_title, hold_expires_at, payment_submitted_at, created_at, ticket_quantity",
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return { data: (data || []).map((row) => mapReservation(row)), error: null };
}

export async function getMyReservation(userId, reservationId) {
  const supabase = await createClient();
  await releaseExpiredHolds(supabase);

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, event_id, status, total_amount, source, event_title, hold_expires_at, payment_submitted_at, created_at, ticket_quantity",
    )
    .eq("id", reservationId)
    .eq("customer_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error };
  }

  const items = await supabase
    .from("reservation_items")
    .select("id, seat_id, seat_label, unit_price, released_at")
    .eq("reservation_id", reservationId)
    .order("seat_label", { ascending: true });

  if (items.error) {
    return { data: null, error: items.error };
  }

  return { data: mapReservation(data, items.data), error: null };
}
