"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { validatePaymentMethod, validatePaymentReference, validateProofFile } from "@/lib/paymentRules";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function readable(error) {
  const message = String(error?.message || "");

  if (isMissingShowingSetup(error) || /submit_payment_proof|review_payment|payments/i.test(message)) {
    return showingSetupMessage();
  }

  if (error?.code === "P0001" && message.length < 300) {
    return message;
  }

  return message.length < 300 ? message : "The payment could not be saved.";
}

async function storeProof(reservationId, proof) {
  const admin = createAdminClient();
  const path = `${reservationId}/${crypto.randomUUID()}.${proof.extension}`;
  const { error } = await admin.storage.from("payment-proofs").upload(path, proof.bytes, {
    contentType: proof.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Could not store the screenshot.");
  }

  return path;
}

export async function submitPaymentProof(formData) {
  await requireRole(["customer"]);
  const reservationId = String(formData.get("reservationId") || "");
  const path = isUuid(reservationId) ? `/account/reservations/${reservationId}` : "/account/reservations";

  if (!isUuid(reservationId)) {
    fail(path, "That reservation could not be found.");
  }

  const method = validatePaymentMethod(formData.get("method"));
  const reference = validatePaymentReference(formData.get("reference"));

  if (!method.ok) {
    fail(path, method.message);
  }

  if (!reference.ok) {
    fail(path, reference.message);
  }

  const file = formData.get("proof");

  if (!file || typeof file === "string") {
    fail(path, "Upload a screenshot of the payment.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const proof = validateProofFile(file, bytes);

  if (!proof.ok) {
    fail(path, proof.message);
  }

  let storedPath = null;

  try {
    storedPath = await storeProof(reservationId, proof.value);
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_payment_proof", {
      p_reservation_id: reservationId,
      p_method: method.value,
      p_reference: reference.value,
      p_proof_path: storedPath,
    });

    if (error) {
      await createAdminClient().storage.from("payment-proofs").remove([storedPath]);
      fail(path, readable(error));
    }
  } catch (error) {
    if (storedPath) {
      await createAdminClient().storage.from("payment-proofs").remove([storedPath]);
    }

    const message = error instanceof Error ? error.message : "Could not store the screenshot.";
    fail(path, message);
  }

  succeed(path, "Payment submitted. Your seats stay held while staff review it.");
}

export async function reviewPayment(formData) {
  await requireRole(EVENT_MANAGER_ROLES);
  const paymentId = String(formData.get("paymentId") || "");
  const decision = String(formData.get("decision") || "");
  const path = "/admin/payments";

  if (!isUuid(paymentId) || !["verified", "rejected"].includes(decision)) {
    fail(path, "Choose a payment to approve or reject.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_payment", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_note: String(formData.get("note") || ""),
  });

  if (error) {
    fail(path, readable(error));
  }

  succeed(path, decision === "verified" ? "Payment confirmed." : "Payment rejected. The customer can resubmit.");
}

export async function savePaymentSettings(formData) {
  await requireRole(EVENT_MANAGER_ROLES);
  const path = "/admin/payments";
  const instructions = String(formData.get("instructions") || "");
  const file = formData.get("qr");
  let qrPath = null;

  if (file && typeof file !== "string" && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = validateProofFile(file, bytes);

    if (!image.ok) {
      fail(path, image.message);
    }

    qrPath = `qr/${crypto.randomUUID()}.${image.value.extension}`;
    const uploaded = await createAdminClient().storage.from("payment-qr").upload(qrPath, image.value.bytes, {
      contentType: image.value.contentType,
      upsert: false,
    });

    if (uploaded.error) {
      fail(path, uploaded.error.message || "Could not store the QR code.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_payment_instructions", {
    p_instructions: instructions,
    p_qr_path: qrPath,
  });

  if (error) {
    if (qrPath) {
      await createAdminClient().storage.from("payment-qr").remove([qrPath]);
    }

    fail(path, readable(error));
  }

  succeed(path, "Payment instructions saved.");
}
