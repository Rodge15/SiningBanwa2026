"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ROLES, validateFullName, validatePhone } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function go(message, kind) {
  redirect(`/account/profile?${kind}=${encodeURIComponent(message)}`);
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
