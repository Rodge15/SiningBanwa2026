import { isUuid } from "./eventRules.js";

export const MAX_SEATS_PER_RESERVATION = 10;

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

export function isReservationStatus(value) {
  return RESERVATION_STATUSES.includes(value);
}

function fail(message) {
  return { ok: false, message };
}

export function validateSeatIds(value) {
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

  if (ids.length > MAX_SEATS_PER_RESERVATION) {
    return fail(`You can reserve at most ${MAX_SEATS_PER_RESERVATION} seats at a time.`);
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
