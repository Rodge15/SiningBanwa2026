import { isUuid } from "./eventRules.js";
import { validateFullName, validatePhone } from "./roles.js";

export const MAX_SEATS_PER_RESERVATION = 10;
export const MAX_STAFF_SEATS = 40;

export const POLL_MS = 4000;

export const RESERVATION_STATUSES = [
  "pending",
  "awaiting_payment",
  "payment_verification",
  "confirmed",
  "rejected",
  "cancelled",
  "expired",
];

const STATUS_LABELS = {
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  payment_verification: "Payment verification",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function reservationStatusLabel(status) {
  return STATUS_LABELS[status] || "Unknown";
}

function fail(message) {
  return { ok: false, message };
}

const SOURCE_LABELS = {
  online: "Online",
  admin: "Admin",
  walk_in: "Walk-in",
};

export function reservationSourceLabel(source) {
  return SOURCE_LABELS[source] || "Unknown";
}

export function validateSeatIds(value, max = MAX_SEATS_PER_RESERVATION) {
  let ids = value;

  if (typeof value === "string") {
    try {
      ids = JSON.parse(value);
    } catch {
      return fail("Select at least one seat.");
    }
  }

  if (!Array.isArray(ids) || ids.length < 1) {
    return fail("Select at least one seat.");
  }

  if (ids.length > max) {
    return fail(`You can reserve at most ${max} seats at a time.`);
  }

  const unique = [];

  for (const id of ids) {
    if (!isUuid(id)) {
      return fail("One of the selected seats is not valid.");
    }

    if (unique.includes(id)) {
      return fail("Each seat can be selected only once.");
    }

    unique.push(id);
  }

  return { ok: true, value: unique };
}

export function validateStaffBooking(input) {
  const source = String(input.source || "");

  if (source !== "admin" && source !== "walk_in") {
    return fail("Choose admin or walk-in.");
  }

  const admissionType = String(input.admissionType || "seated");
  let seatIds = [];
  let quantity = 0;

  if (admissionType === "general") {
    quantity = Number(input.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_STAFF_SEATS) {
      return fail("Choose 1 to 40 tickets.");
    }
  } else {
    const seats = validateSeatIds(input.seatIds || "[]", MAX_STAFF_SEATS);

    if (!seats.ok) {
      return seats;
    }

    seatIds = seats.value;
  }

  if (String(input.customerMode || "") === "existing") {
    if (!isUuid(input.customerId)) {
      return fail("Choose a customer account.");
    }

    return {
      ok: true,
      value: {
        source,
        customerId: input.customerId,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        seatIds,
        quantity,
      },
    };
  }

  const name = validateFullName(input.customerName);
  const phone = validatePhone(input.customerPhone);
  const email = String(input.customerEmail || "").trim();

  if (!name.ok) {
    return name;
  }

  if (!phone.ok || !phone.value) {
    return fail("Enter a phone number for this customer.");
  }

  if (email && (email.length > 200 || !email.includes("@"))) {
    return fail("Enter a valid email, or leave it blank.");
  }

  return {
    ok: true,
    value: {
      source,
      customerId: null,
      customerName: name.value,
      customerPhone: phone.value,
      customerEmail: email,
      seatIds,
      quantity,
    },
  };
}

export function sumSnapshotPrices(items) {
  return (items || []).reduce((total, item) => {
    const price = Number(item.unitPrice ?? item.unit_price);
    return total + (Number.isFinite(price) ? price : 0);
  }, 0);
}

export function totalsMatch(storedTotal, items) {
  const stored = Number(storedTotal);
  const snapshot = sumSnapshotPrices(items);

  if (!Number.isFinite(stored)) {
    return false;
  }

  return Math.round(stored * 100) === Math.round(snapshot * 100);
}
