import { createClient } from "@/lib/supabase/server";

export const EVENT_COLUMNS =
  "id, title, description, venue, starts_at, poster_path, status, created_by, created_at, updated_at, admission_type, audience_capacity, ticket_price";

export function isMissingEventTable(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|could not find the table/i.test(message)
  );
}

export function eventSetupMessage() {
  return "The events table is not ready. Run the Phase 2 SQL migration, then refresh this page.";
}

export function isMissingAdmissionColumns(error) {
  return /admission_type|audience_capacity|ticket_price|schema cache/i.test(String(error?.message || ""));
}

export function eventLoadMessage(error) {
  if (isMissingAdmissionColumns(error)) {
    return "Event admission columns are not ready. In the Supabase SQL Editor, run supabase/migrations/20261026120000_seat_tiers_and_admission.sql once, then refresh.";
  }

  if (isMissingEventTable(error)) {
    return eventSetupMessage();
  }

  return "Events could not be loaded.";
}

export async function listPublishedEvents() {
  const supabase = await createClient();
  return supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "published")
    .order("starts_at", { ascending: true });
}

export async function getVisibleEvent(id) {
  const supabase = await createClient();
  return supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
}

export async function listManagedEvents() {
  const supabase = await createClient();
  return supabase.from("events").select(EVENT_COLUMNS).order("starts_at", { ascending: true });
}
