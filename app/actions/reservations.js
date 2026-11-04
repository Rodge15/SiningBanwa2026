"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { isMissingReservationSetup, reservationSetupMessage } from "@/lib/reservations";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";
import { validateSeatIds, validateStaffBooking } from "@/lib/reservationRules";
import { EVENT_MANAGER_ROLES, ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function readableDbError(error) {
  const message = String(error?.message || "");

  if (isMissingReservationSetup(error) || isMissingShowingSetup(error)) {
    return isMissingShowingSetup(error) ? showingSetupMessage() : reservationSetupMessage();
  }

  if (error?.code === "P0001" && message && message.length < 300) {
    return message;
  }

  return "The reservation could not be saved.";
}

export async function createReservation(formData) {
  await requireRole(["customer"]);
  const eventId = String(formData.get("eventId") || "");
  const showingId = String(formData.get("showingId") || "");
  const path = isUuid(eventId) ? `/events/${eventId}/reserve?showing=${showingId}` : "/events";

  if (!isUuid(eventId) || !isUuid(showingId)) {
    fail(isUuid(eventId) ? `/events/${eventId}/reserve` : "/events", "Choose a showing before selecting seats.");
  }

  const seats = validateSeatIds(String(formData.get("seatIds") || ""));

  if (!seats.ok) {
    fail(path, seats.message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_online_reservation", {
    p_showing_id: showingId,
    p_seat_ids: seats.value,
  });

  if (error || !isUuid(data)) {
    fail(path, error ? readableDbError(error) : "The reservation could not be saved.");
  }

  succeed(`/account/reservations/${data}`, "Seats are on hold for 5 minutes. Submit your payment proof before the hold ends.");
}

export async function createGeneralAdmissionReservation(formData) {
  await requireRole(["customer"]);
  const eventId = String(formData.get("eventId") || "");
  const showingId = String(formData.get("showingId") || "");
  const path = isUuid(eventId) ? `/events/${eventId}/reserve?showing=${showingId}` : "/events";
  const quantity = Number(formData.get("quantity"));

  if (!isUuid(eventId) || !isUuid(showingId)) {
    fail(isUuid(eventId) ? `/events/${eventId}/reserve` : "/events", "Choose a showing before selecting tickets.");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    fail(path, "Choose 1 to 10 tickets.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_general_admission_reservation", {
    p_showing_id: showingId,
    p_quantity: quantity,
  });

  if (error || !isUuid(data)) {
    fail(path, error ? readableDbError(error) : "The reservation could not be saved.");
  }

  succeed(`/account/reservations/${data}`, "Tickets are on hold for 5 minutes. Submit your payment proof before the hold ends.");
}

export async function searchBookingCustomers(query) {
  await requireRole(EVENT_MANAGER_ROLES);
  const text = String(query || "").trim();

  if (text.length < 2) {
    return { matches: [], message: "Type at least 2 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_booking_customers", { p_query: text });

  if (error) {
    return { matches: [], message: readableDbError(error) };
  }

  return { matches: data || [], message: "" };
}

export async function createStaffReservation(formData) {
  await requireRole(EVENT_MANAGER_ROLES);
  const eventId = String(formData.get("eventId") || "");
  const showingId = String(formData.get("showingId") || "");
  const path = isUuid(eventId) ? `/events/manage/${eventId}/book?showing=${showingId}` : "/events/manage";
  const checked = validateStaffBooking({
    source: formData.get("source"),
    customerMode: formData.get("customerMode"),
    customerId: formData.get("customerId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
    admissionType: formData.get("admissionType"),
    seatIds: formData.get("seatIds"),
    quantity: Number(formData.get("quantity")),
  });

  if (!isUuid(eventId) || !isUuid(showingId)) {
    fail(isUuid(eventId) ? `/events/manage/${eventId}/book` : "/events/manage", "Choose a showing before recording the sale.");
  }

  if (!checked.ok) {
    fail(path, checked.message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_reservation", {
    p_showing_id: showingId,
    p_source: checked.value.source,
    p_customer_id: checked.value.customerId,
    p_customer_name: checked.value.customerName,
    p_customer_phone: checked.value.customerPhone,
    p_customer_email: checked.value.customerEmail,
    p_seat_ids: checked.value.seatIds,
    p_quantity: checked.value.quantity,
  });

  if (error || !isUuid(data)) {
    fail(path, error ? readableDbError(error) : "The booking could not be saved.");
  }

  succeed(path, "The booking was saved and marked sold. No hold and no payment screenshot were used.");
}

export async function cancelReservation(formData) {
  await requireRole(ROLES);
  const reservationId = String(formData.get("reservationId") || "");
  const path = isUuid(reservationId) ? `/account/reservations/${reservationId}` : "/account/reservations";

  if (!isUuid(reservationId)) {
    fail(path, "That reservation could not be found.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_online_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) {
    fail(path, readableDbError(error));
  }

  succeed(path, "The hold was cancelled and the seats were released.");
}
