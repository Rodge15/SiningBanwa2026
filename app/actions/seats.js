"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { isMissingSeatTable, seatSetupMessage } from "@/lib/seats";
import { validateLayout } from "@/lib/seatRules";
import { createClient } from "@/lib/supabase/server";

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function readableDbError(error) {
  const message = String(error?.message || "");

  if (isMissingSeatTable(error)) {
    return seatSetupMessage();
  }

  if (error?.code === "P0001" && message && message.length < 300) {
    return message;
  }

  return "The seat layout could not be saved.";
}

export async function saveSeatLayout(formData) {
  await requireRole(EVENT_MANAGER_ROLES);
  const eventId = String(formData.get("eventId") || "");
  const path = isUuid(eventId) ? `/events/manage/${eventId}/seats` : "/events/manage";

  if (!isUuid(eventId)) {
    fail(path, "That event could not be found.");
  }

  let layout;

  try {
    layout = JSON.parse(String(formData.get("layout") || ""));
  } catch {
    fail(path, "Seat layout must include a sections list.");
  }

  const parsed = validateLayout(layout);

  if (!parsed.ok) {
    fail(path, parsed.message);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_event_layout", {
    p_event_id: eventId,
    p_layout: parsed.value,
  });

  if (error) {
    fail(path, readableDbError(error));
  }

  succeed(path, "Seat layout saved.");
}
