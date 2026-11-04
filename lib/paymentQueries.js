import { createClient } from "@/lib/supabase/server";
import { isMissingShowingSetup } from "@/lib/showings";

export async function getPaymentSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_settings").select("instructions, qr_path").eq("id", 1).maybeSingle();
  return { data, error };
}

export async function listReservationPayments(reservationId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, status, amount, method, reference_number, submitted_at, verified_at, verified_by_name, rejection_note")
    .eq("reservation_id", reservationId)
    .order("submitted_at", { ascending: false });

  return { data: data || [], error };
}

export async function listPendingPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, reservation_id, amount, method, reference_number, submitted_at, event_id")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  return { data: data || [], error };
}

export async function countPendingPayments() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error && isMissingShowingSetup(error)) {
    return 0;
  }

  return count || 0;
}
