"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ROLES, validateFullName, validatePhone } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function go(message, kind) {
  redirect(`/account/profile?${kind}=${encodeURIComponent(message)}`);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Every signed-in role can edit only their own name and phone.
// Email and role are not accepted here, and the database grant blocks those columns.
export async function updateProfile(formData) {
  const { user } = await requireRole(ROLES);
  const name = validateFullName(formData.get("fullName"));
  const phone = validatePhone(formData.get("phone"));

  if (!name.ok) {
    go(name.message, "error");
  }

  if (!phone.ok) {
    go(phone.message, "error");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name.value, phone: phone.value })
    .eq("id", user.id);

  if (error) {
    go("Your profile could not be saved.", "error");
  }

  go("Your profile was saved.", "message");
}

// Changing the login email. The current password is checked first, then Supabase
// sends a confirmation link to the new address; the change takes effect only
// after the customer clicks it. A database trigger then syncs profiles.email.
export async function changeEmail(formData) {
  const { user } = await requireRole(ROLES);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const currentPassword = String(formData.get("emailPassword") || "");

  if (!isValidEmail(email)) {
    go("Enter a valid email address.", "error");
  }

  if (!currentPassword) {
    go("Enter your current password to change your email.", "error");
  }

  if (!user.email) {
    go("This account has no email on file, so it cannot be changed here.", "error");
  }

  if (email === user.email.toLowerCase()) {
    go("That is already your email address.", "error");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    go("Current password is incorrect. Your email was not changed.", "error");
  }

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    go(error.message || "The email could not be changed.", "error");
  }

  go("Almost done — open the confirmation link we sent to your new email to finish the change.", "message");
}

// The current password is checked first. A wrong password never reaches the update.
export async function changePassword(formData) {
  const { user } = await requireRole(ROLES);
  const currentPassword = String(formData.get("currentPassword") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword) {
    go("Enter your current password.", "error");
  }

  if (password.length < 8) {
    go("New password must be at least 8 characters.", "error");
  }

  if (password !== confirmPassword) {
    go("The two new passwords do not match.", "error");
  }

  if (!user.email) {
    go("This account has no email, so the password cannot be checked.", "error");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    go("Current password is incorrect. Your password was not changed.", "error");
  }

  if (password === currentPassword) {
    go("Choose a new password that is different from the current one.", "error");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    go("The password could not be changed.", "error");
  }

  go("Your password was changed. Use it the next time you log in.", "message");
}