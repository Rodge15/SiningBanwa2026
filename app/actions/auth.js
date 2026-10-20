"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

function readText(formData, name) {
  return String(formData.get(name) || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ensureConfigured(path) {
  if (!getPublicSupabaseEnv().configured) {
    fail(path, "Supabase is not configured. Add the keys to .env.local and restart the server.");
  }
}

async function siteUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function signUp(formData) {
  ensureConfigured("/signup");
  const email = readText(formData, "email");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!isValidEmail(email)) {
    fail("/signup", "Enter a valid email address.");
  }

  if (password.length < 8) {
    fail("/signup", "Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    fail("/signup", "The two passwords do not match.");
  }

  const supabase = await createClient();
  const origin = await siteUrl();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    fail("/signup", error.message);
  }

  redirect(
    `/signup?message=${encodeURIComponent("Check your email and open the confirmation link before you log in.")}`,
  );
}

export async function signIn(formData) {
  ensureConfigured("/login");
  const email = readText(formData, "email");
  const password = String(formData.get("password") || "");

  if (!isValidEmail(email) || !password) {
    fail("/login", "Enter your email and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    fail("/login", error.message);
  }

  redirect("/account");
}

export async function signOut() {
  ensureConfigured("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData) {
  ensureConfigured("/forgot-password");
  const email = readText(formData, "email");

  if (!isValidEmail(email)) {
    fail("/forgot-password", "Enter a valid email address.");
  }

  const supabase = await createClient();
  const origin = await siteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?type=recovery`,
  });

  if (error) {
    fail("/forgot-password", error.message);
  }

  redirect(
    `/forgot-password?message=${encodeURIComponent("If that email has an account, a reset link is on its way.")}`,
  );
}

export async function updatePassword(formData) {
  ensureConfigured("/reset-password");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 8) {
    fail("/reset-password", "Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    fail("/reset-password", "The two passwords do not match.");
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    fail("/forgot-password", "Open the reset link from your email, then choose a new password.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    fail("/reset-password", error.message);
  }

  redirect(`/account?message=${encodeURIComponent("Your password was updated.")}`);
}
