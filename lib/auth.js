import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const getCurrentUser = cache(async () => {
  await connection();

  if (!getPublicSupabaseEnv().configured) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

// Returns { user, profile, error }. profile is null for guests or when the row is missing.
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, profile: null, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, is_active, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: data || null, error };
});

function redirectWithError(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// The ONE role check. Every protected page, route, and server action calls this.
export async function requireRole(allowedRoles) {
  const { user, profile, error } = await getCurrentProfile();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile) {
    throw new Error(
      "Could not load your profile. Run the Phase 3 migration (20261022120000_create_profiles.sql) in Supabase.",
    );
  }

  if (!profile.is_active) {
    redirect("/auth/inactive");
  }

  if (!allowedRoles.includes(profile.role)) {
    redirectWithError("/account", "You do not have permission to open that page.");
  }

  return { user, profile };
}
