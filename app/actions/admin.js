"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ADMIN_ROLES, isRole, validateFullName, validatePhone } from "@/lib/roles";
import { isUuid } from "@/lib/eventRules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function go(message, kind) {
  redirect(`/admin/users?${kind}=${encodeURIComponent(message)}`);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function setProfileAccess(formData) {
  const { user } = await requireRole(ADMIN_ROLES);
  const targetId = String(formData.get("id") || "");
  const role = String(formData.get("role") || "");
  const isActive = formData.get("isActive") === "on";

  if (!isUuid(targetId) || !isRole(role)) {
    go("That request was not valid.", "error");
  }

  if (targetId === user.id) {
    go("You cannot change your own role or status.", "error");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profile_access", {
    target_id: targetId,
    new_role: role,
    new_active: isActive,
  });

  if (error) {
    go(error.message || "The account could not be updated.", "error");
  }

  go("Account updated.", "message");
}

// Full edit of another user's details: name, phone, email, role, and status.
export async function adminUpdateUser(formData) {
  const { user } = await requireRole(ADMIN_ROLES);
  const targetId = String(formData.get("id") || "");

  if (!isUuid(targetId)) {
    go("That request was not valid.", "error");
  }

  const back = (message, kind) =>
    redirect(`/admin/users/${targetId}?${kind}=${encodeURIComponent(message)}`);

  if (targetId === user.id) {
    back("Use Settings to edit your own account.", "error");
  }

  const name = validateFullName(formData.get("fullName"));
  const phone = validatePhone(formData.get("phone"));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  const isActive = formData.get("isActive") === "on";

  if (!name.ok) {
    back(name.message, "error");
  }
  if (!phone.ok) {
    back(phone.message, "error");
  }
  if (!isValidEmail(email)) {
    back("Enter a valid email address.", "error");
  }
  if (!isRole(role)) {
    back("Choose a valid role.", "error");
  }

  const admin = createAdminClient();

  // Change the login email only if it actually changed.
  const { data: current } = await admin.auth.admin.getUserById(targetId);
  const currentEmail = current?.user?.email?.toLowerCase() || "";

  if (email !== currentEmail) {
    const { error: emailError } = await admin.auth.admin.updateUserById(targetId, {
      email,
      email_confirm: true,
    });

    if (emailError) {
      back(emailError.message || "The email could not be updated.", "error");
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: name.value, phone: phone.value, email })
    .eq("id", targetId);

  if (profileError) {
    back("The profile could not be saved.", "error");
  }

  // Role and status go through the RPC that enforces the admin rules.
  const supabase = await createClient();
  const { error: accessError } = await supabase.rpc("set_profile_access", {
    target_id: targetId,
    new_role: role,
    new_active: isActive,
  });

  if (accessError) {
    back(accessError.message || "The role or status could not be updated.", "error");
  }

  go("Account updated.", "message");
}

// Permanently delete a user (auth account + profile).
export async function deleteUser(formData) {
  const { user } = await requireRole(ADMIN_ROLES);
  const targetId = String(formData.get("id") || "");

  if (!isUuid(targetId)) {
    go("That request was not valid.", "error");
  }

  if (targetId === user.id) {
    redirect(
      `/admin/users/${targetId}?error=${encodeURIComponent("You cannot delete your own account.")}`,
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);

  if (error) {
    const message = /foreign key|violat|referenced|constraint/i.test(error.message || "")
      ? "This account has bookings or payments, so it can't be deleted. Set it to inactive instead."
      : error.message || "The account could not be deleted.";
    redirect(`/admin/users/${targetId}?error=${encodeURIComponent(message)}`);
  }

  go("Account deleted.", "message");
}