import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPaymentSettings } from "@/lib/paymentQueries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request) {
  const dest = request.headers.get("sec-fetch-dest");
  const accept = request.headers.get("accept") || "";

  if (dest === "document" || (!dest && accept.includes("text/html"))) {
    return NextResponse.redirect(new URL("/account/reservations", request.url));
  }

  const { profile } = await getCurrentProfile();

  if (!profile?.is_active) {
    return new Response("Not found", { status: 404 });
  }

  const settings = await getPaymentSettings();

  if (settings.error || !settings.data?.qr_path) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const signed = await createAdminClient().storage.from("payment-qr").createSignedUrl(settings.data.qr_path, 60);

    if (signed.error || !signed.data?.signedUrl) {
      return new Response("QR unavailable", { status: 404 });
    }

    const response = NextResponse.redirect(signed.data.signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new Response("Payment storage is not configured.", { status: 503 });
  }
}
