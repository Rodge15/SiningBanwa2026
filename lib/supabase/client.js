import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = getPublicSupabaseEnv();

  if (!env.configured) {
    throw new Error("Supabase is not configured. Add the URL and anon key to .env.local.");
  }

  return createBrowserClient(env.url, env.anonKey);
}
