import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function redirectTo(request, pathname, error) {
  const destination = request.nextUrl.clone();
  destination.pathname = pathname;
  destination.search = "";

  if (error) {
    destination.searchParams.set("error", error);
  }

  return NextResponse.redirect(destination);
}

export async function GET(request) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const nextPath = type === "recovery" ? "/reset-password" : "/account";

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return redirectTo(request, "/login", error.message);
      }

      return redirectTo(request, nextPath);
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (error) {
        return redirectTo(request, "/login", error.message);
      }

      return redirectTo(request, nextPath);
    }

    return redirectTo(
      request,
      "/login",
      "This confirmation link is incomplete. Request a new email and try again.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm this link.";
    return redirectTo(request, "/login", message);
  }
}
