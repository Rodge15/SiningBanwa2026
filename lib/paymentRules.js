import { detectImageType, POSTER_TYPES } from "./eventRules.js";

export const PAYMENT_METHODS = ["gcash", "bank"];
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

const REFERENCE_PATTERN = /^[A-Za-z0-9-]{4,40}$/;

export function paymentMethodLabel(method) {
  if (method === "gcash") {
    return "GCash";
  }

  if (method === "bank") {
    return "Bank transfer";
  }

  return "Payment";
}

export function validatePaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  if (!PAYMENT_METHODS.includes(method)) {
    return { ok: false, message: "Choose GCash or bank transfer." };
  }

  return { ok: true, value: method };
}

export function validatePaymentReference(value) {
  const reference = String(value || "").trim();

  if (!REFERENCE_PATTERN.test(reference)) {
    return { ok: false, message: "Enter the payment reference (4 to 40 letters, numbers, or hyphens)." };
  }

  return { ok: true, value: reference };
}

export function validateProofFile(file, bytes) {
  if (!file || file.size === 0) {
    return { ok: false, message: "Upload a screenshot of the payment." };
  }

  if (file.size > PROOF_MAX_BYTES || bytes.length > PROOF_MAX_BYTES) {
    return { ok: false, message: "The screenshot must be 5 MiB or smaller." };
  }

  const detected = detectImageType(bytes);

  if (!detected || !POSTER_TYPES[detected]) {
    return { ok: false, message: "The screenshot must be a JPG, PNG, or WebP image." };
  }

  if (file.type && file.type !== "application/octet-stream" && file.type !== detected) {
    return { ok: false, message: "The screenshot file type does not match its contents." };
  }

  return {
    ok: true,
    value: {
      bytes,
      contentType: detected,
      extension: POSTER_TYPES[detected],
    },
  };
}
