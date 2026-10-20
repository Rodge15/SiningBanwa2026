import { NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  const env = getPublicSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const serviceRoleConfigured =
    serviceRoleKey.length > 20 && !serviceRoleKey.includes("your-service-role-key");

  if (!env.configured) {
    return NextResponse.json(
      {
        ok: false,
        supabaseReachable: false,
        serviceRoleConfigured,
        message: "Add your Supabase URL and anon key to .env.local, then restart the dev server.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
      cache: "no-store",
    });

    return NextResponse.json(
      {
        ok: response.ok,
        supabaseReachable: response.ok,
        serviceRoleConfigured,
        message: response.ok
          ? "The app can reach Supabase Auth."
          : "Supabase Auth did not accept the connection. Check the URL and anon key.",
      },
      { status: response.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        supabaseReachable: false,
        serviceRoleConfigured,
        message: "The app could not reach Supabase. Check your internet connection and project URL.",
      },
      { status: 502 },
    );
  }
}
