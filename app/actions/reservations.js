"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { isMissingReservationSetup, reservationSetupMessage } from "@/lib/reservations";
import { validateSeatIds } from "@/lib/reservationRules";
import { ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function readableDbError(error) {
  const message = String(error?.message || "");

  if (isMissingReservationSetup(error)) {
    return reservationSetupMessage();
  }

  if (error?.code === "P0001" && message && message.length < 300) {
    return message;
  }

  return "The reservation could not be saved.";
}

export async function createReservation(formData) {
  await requireRole(["customer"]);
  const eventId = String(formData.get("eventId") || "");
  const path = isUuid(eventId) ? `/events/${eventId}/reserve` : "/events";

  if (!isUuid(eventId)) {
    fail(path, "That event could not be found.");
  }

  const seats = validateSeatIds(String(formData.get("seatIds") || ""));

  if (!seats.ok) {
    fail(path, seats.message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_online_reservation", {
    p_event_id: eventId,
    p_seat_ids: seats.value,
  });

  if (error || !isUuid(data)) {
    fail(path, error ? readableDbError(error) : "The reservation could not be saved.");
  }

  succeed(`/account/reservations/${data}`, "Seats are on hold. Payment is not part of this step.");
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
