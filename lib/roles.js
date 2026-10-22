export const ROLES = ["customer", "administrator", "staff", "venue"];

export const EVENT_MANAGER_ROLES = ["administrator", "staff"];

export const ADMIN_ROLES = ["administrator"];

export function isRole(value) {
  return ROLES.includes(value);
}

export function roleLabel(role) {
  const labels = {
    customer: "Customer",
    administrator: "Administrator",
    staff: "Staff",
    venue: "Venue personnel",
  };

  return labels[role] || "Unknown";
}

export function validateFullName(value) {
  const name = String(value || "").trim();

  if (name.length < 2 || name.length > 120) {
    return { ok: false, message: "Full name must be 2 to 120 characters." };
  }

  return { ok: true, value: name };
}

// Optional. Blank is allowed. A value must look like a phone number and fit the database column.
export function validatePhone(value) {
  const phone = String(value || "").trim();

  if (!phone) {
    return { ok: true, value: null };
  }

  const digits = phone.replace(/\D/g, "");

  if (phone.length > 30 || digits.length < 7 || digits.length > 15 || !/^[0-9+\-().\s]+$/.test(phone)) {
    return { ok: false, message: "Enter a valid phone number, or leave it blank." };
  }

  return { ok: true, value: phone };
}
