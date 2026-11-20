"use server";

import { requireRole } from "@/lib/auth";
import { bookingReference } from "@/lib/bookingReference";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// A scanned code is either the QR (a URL containing the reservation UUID) or the
// Code 128 barcode (the reference SB-XXXXXXXX). Figure out which.
function parseScanned(raw) {
  const text = String(raw || "").trim();

  const uuid = text.match(UUID_RE);
  if (uuid) {
    return { id: uuid[0].toLowerCase() };
  }

  const ref = text.toUpperCase().match(/SB-?([0-9A-F]{8})/);
  if (ref) {
    return { hex8: ref[1].toLowerCase() };
  }

  return {};
}

// Resolves a reference prefix (first 8 hex of the UUID) to a reservation id by
// scanning the UUID range it covers. Uses the primary-key index.
async function resolveByPrefix(hex8) {
  const admin = createAdminClient();
  const low = `${hex8}-0000-0000-0000-000000000000`;
  const high = `${hex8}-ffff-ffff-ffff-ffffffffffff`;

  const { data } = await admin
    .from("reservations")
    .select("id")
    .gte("id", low)
    .lte("id", high)
    .limit(2);

  if (!data || data.length === 0) {
    return { outcome: "not_found" };
  }
  if (data.length > 1) {
    return { outcome: "ambiguous" };
  }
  return { id: data[0].id };
}

// Called by the staff scanner with whatever the camera (or manual box) read.
// Returns a plain result object the client renders. Never throws for normal
// not-found/used cases.
export async function admitBooking(raw) {
  await requireRole(EVENT_MANAGER_ROLES);

  const parsed = parseScanned(raw);
  let reservationId = parsed.id || null;

  if (!reservationId && parsed.hex8) {
    const resolved = await resolveByPrefix(parsed.hex8);
    if (resolved.outcome) {
      return resolved;
    }
    reservationId = resolved.id;
  }

  if (!reservationId) {
    return { outcome: "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admit_booking", {
    p_reservation_id: reservationId,
  });

  if (error) {
    return { outcome: "error", message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { outcome: "not_found" };
  }

  return {
    outcome: row.outcome,
    reference: bookingReference(reservationId),
    eventTitle: row.event_title,
    customerName: row.customer_name,
    tickets: row.tickets,
    status: row.reservation_status,
    admittedAt: row.admitted_at,
  };
}