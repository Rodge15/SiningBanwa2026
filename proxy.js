import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase email links sometimes deliver the confirmation code to the site
  // root. Forward it to the route that exchanges it for a session.
  if (pathname === "/" && (searchParams.has("code") || searchParams.get("type") === "recovery")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};