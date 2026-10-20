import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

function withSessionCookies(source, response) {
  source.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });
  return response;
}

export async function updateSession(request) {
  const env = getPublicSupabaseEnv();
  const path = request.nextUrl.pathname;

  if (!env.configured) {
    if (path === "/account" || path.startsWith("/account/")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set(
        "error",
        "Add your Supabase keys to .env.local and restart the server.",
      );
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
    const user = data.user;
    const isProtected = path === "/account" || path.startsWith("/account/");
  const isGuestOnly = path === "/login" || path === "/signup";

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return withSessionCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  if (isGuestOnly && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/account";
    redirectUrl.search = "";
    return withSessionCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  return supabaseResponse;
}
