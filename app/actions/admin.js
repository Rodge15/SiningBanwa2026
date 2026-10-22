"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ADMIN_ROLES, isRole } from "@/lib/roles";
import { isUuid } from "@/lib/eventRules";
import { createClient } from "@/lib/supabase/server";

function go(message, kind) {
  redirect(`/admin/users?${kind}=${encodeURIComponent(message)}`);
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
