import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  const { id } = await params;

  if (!isUuid(id)) {
    return new Response("Not found", { status: 404 });
  }

  const { profile, user } = await getCurrentProfile();

  if (!user || !profile?.is_active) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("id, customer_id, proof_path").eq("id", id).maybeSingle();
  const isStaff = EVENT_MANAGER_ROLES.includes(profile.role);
  const isOwner = data?.customer_id === user.id;

  if (error || !data?.proof_path || (!isStaff && !isOwner)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const signed = await createAdminClient().storage.from("payment-proofs").createSignedUrl(data.proof_path, 60);

    if (signed.error || !signed.data?.signedUrl) {
      return new Response("Screenshot unavailable", { status: 404 });
    }

    const response = NextResponse.redirect(signed.data.signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new Response("Payment storage is not configured.", { status: 503 });
  }
}
