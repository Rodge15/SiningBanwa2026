import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Inactive accounts are signed out, then sent to the login page with a message.
export async function GET(request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  url.searchParams.set("error", "This account is inactive. Please contact an administrator.");
  return NextResponse.redirect(url);
}
