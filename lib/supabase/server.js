import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  const env = getPublicSupabaseEnv();

  if (!env.configured) {
    throw new Error("Supabase is not configured. Add the URL and anon key to .env.local.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // A Server Component cannot always write cookies.
          // proxy.js refreshes the session on the next request.
        }
      },
    },
  });
}
