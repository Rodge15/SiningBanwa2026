import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("The service role key must never be used in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing =
    !url ||
    !serviceRoleKey ||
    url.includes("your-project-ref") ||
    serviceRoleKey.includes("your-service-role-key");

  if (missing) {
    throw new Error("The service role key is missing. Keep it only in .env.local.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
