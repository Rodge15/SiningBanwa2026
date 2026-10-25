import { NextResponse } from "next/server";
import { isMissingReservationSetup, reservationSetupMessage } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_expired_seat_holds");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        released: 0,
        message: isMissingReservationSetup(error)
          ? reservationSetupMessage()
          : "Expired holds could not be released.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, released: Number(data) || 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
