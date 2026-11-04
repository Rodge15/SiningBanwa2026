import { createClient } from "@/lib/supabase/server";

export function isMissingReservationSetup(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|could not find the (table|function)|release_expired_seat_holds|create_online_reservation|cancel_online_reservation|create_staff_reservation|event_ticket_counts|online_sales_closed_reason|customer_name|showing_id|showings|payments/i.test(
      message,
    )
  );
}

export function reservationSetupMessage() {
  return "Reservation setup is not ready. In the Supabase SQL Editor, run the earlier reservation files if needed, then supabase/migrations/20261104120000_showings_and_payments.sql once. Refresh after it succeeds. Do not drop tables.";
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
    showingId: row.showing_id || null,
    showingStartsAt: row.showing_starts_at || null,
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
      "id, event_id, showing_id, status, total_amount, source, event_title, hold_expires_at, payment_submitted_at, created_at, ticket_quantity",
    )
    .eq("id", reservationId)
    .eq("customer_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error };
  }

    let showingStartsAt = null;

    if (data.showing_id) {
      const showing = await supabase.from("showings").select("starts_at").eq("id", data.showing_id).maybeSingle();

      if (showing.error && !isMissingReservationSetup(showing.error)) {
        return { data: null, error: showing.error };
      }

      showingStartsAt = showing.data?.starts_at || null;
    }

    const items = await supabase
    .from("reservation_items")
    .select("id, seat_id, seat_label, unit_price, released_at")
    .eq("reservation_id", reservationId)
    .order("seat_label", { ascending: true });

  if (items.error) {
    return { data: null, error: items.error };
  }

  return { data: mapReservation({ ...data, showing_starts_at: showingStartsAt }, items.data), error: null };
}
