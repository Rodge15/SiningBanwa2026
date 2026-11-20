"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { code128Png } from "@/lib/barcodePng";
import { bookingReference } from "@/lib/bookingReference";
import { sendMail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { isUuid } from "@/lib/eventRules";
import { validatePaymentMethod, validatePaymentReference, validateProofFile } from "@/lib/paymentRules";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function fail(path, message) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`);
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

  // Email the admin (there is something to review) and the customer (we got it).
  // Best-effort, so it never blocks the submission.
  await notifyPaymentSubmitted(reservationId);

  // Send the customer to their reservations list after submitting, so they see
  // the booking move to "Confirmation in progress" among all their reservations.
  succeed("/account/reservations", "Payment submitted. Your booking is now waiting for staff to verify it.");
}

// Builds the booking reference block for an email: the big reference number,
// the Code 128 barcode, and the QR code. Barcode and QR are attached as PNGs
// (cid) because email clients strip inline SVG and often block data-URI images.
async function buildBookingCodes(reservation) {
  const reference = bookingReference(reservation.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const qrPayload = site ? `${site}/account/reservations/${reservation.id}` : reference;
  const attachments = [];

  const barcode = code128Png(reference, { height: 70, moduleWidth: 2, margin: 12 });
  if (barcode) {
    attachments.push({ filename: `${reference}.png`, content: barcode, cid: "barcode" });
  }

  let qr = null;
  try {
    qr = await QRCode.toBuffer(qrPayload, { margin: 1, width: 220 });
  } catch {
    qr = null;
  }
  if (qr) {
    attachments.push({ filename: `${reference}-qr.png`, content: qr, cid: "qr" });
  }

  const html = `
    <div style="margin:16px 0;padding:16px;border:1px solid #e4d8cc;border-radius:12px;text-align:center">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#7a2f2f">Booking reference</div>
      <div style="font-size:26px;font-weight:700;letter-spacing:.12em;margin:4px 0 12px;color:#1f1a17">${reference}</div>
      ${barcode ? `<img src="cid:barcode" alt="${reference}" style="max-width:100%;height:auto"/>` : ""}
      ${qr ? `<div style="margin-top:12px"><img src="cid:qr" alt="QR for ${reference}" width="150" height="150" style="border:1px solid #e4d8cc;border-radius:8px"/></div>` : ""}
    </div>`;

  return { reference, attachments, html };
}

// Best-effort notifications when a customer submits their payment:
//  - the admin/staff gets an email that a new payment is waiting for review
//  - the customer gets an email confirming the payment was received
async function notifyPaymentSubmitted(reservationId) {
  try {
    const admin = createAdminClient();

    const { data: reservation } = await admin
      .from("reservations")
      .select("id, customer_id, event_title, total_amount")
      .eq("id", reservationId)
      .maybeSingle();

    if (!reservation) {
      return;
    }

    const amount = formatPeso(reservation.total_amount);
    const eventTitle = reservation.event_title || "an event";
    const site = process.env.NEXT_PUBLIC_SITE_URL || "";
    const codes = await buildBookingCodes(reservation);
    const reference = codes.reference;

    // 1) Notify the admin inbox (with the barcode so staff can match it).
    const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER || "";
    if (adminTo) {
      const reviewLink = site ? `${site}/admin/payments` : "";
      await sendMail({
        to: adminTo,
        subject: `New payment to review — ${reference}`,
        attachments: codes.attachments,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1f1a17">
            <h2 style="color:#7a2f2f;margin:0 0 8px">New payment submitted</h2>
            <p>A customer booked and submitted a payment. It is waiting for review.</p>
            <p style="color:#6b5e57;margin:0"><strong>Event:</strong> ${eventTitle} &middot; <strong>Amount:</strong> ${amount}</p>
            ${codes.html}
            ${reviewLink ? `<p><a href="${reviewLink}" style="color:#7a2f2f">Open the payment review page</a></p>` : ""}
          </div>
        `,
      });
    }

    // 2) Confirm to the customer that the payment was received.
    if (reservation.customer_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", reservation.customer_id)
        .maybeSingle();

      if (profile?.email) {
        const name = profile.full_name || "there";
        const link = site ? `${site}/account/reservations/${reservation.id}` : "";
        await sendMail({
          to: profile.email,
          subject: `We received your payment — ${reference}`,
          attachments: codes.attachments,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1f1a17">
              <h2 style="color:#7a2f2f;margin:0 0 8px">Payment received</h2>
              <p>Hi ${name},</p>
              <p>We received your payment for <strong>${eventTitle}</strong> (${amount}). Our staff will verify it shortly — you'll get another message once it's confirmed.</p>
              ${codes.html}
              <p>Keep this reference and barcode for verification.</p>
              ${link ? `<p><a href="${link}" style="color:#7a2f2f">Track your booking</a></p>` : ""}
              <p style="color:#6b5e57;font-size:13px">Sining Banwa</p>
            </div>
          `,
        });
      }
    }
  } catch {
    // Notifications must never affect the submission outcome.
  }
}

// Best-effort confirmation email after a payment is approved. It looks up the
// customer and emails them their booking reference. Any failure is swallowed so
// a mail problem can never block or undo the approval.
async function notifyPaymentVerified(paymentId) {
  try {
    const admin = createAdminClient();

    const { data: payment } = await admin
      .from("payments")
      .select("reservation_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment?.reservation_id) {
      return;
    }

    const { data: reservation } = await admin
      .from("reservations")
      .select("id, customer_id, event_title, total_amount")
      .eq("id", payment.reservation_id)
      .maybeSingle();

    if (!reservation?.customer_id) {
      return;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", reservation.customer_id)
      .maybeSingle();

    if (!profile) {
      return;
    }

    const name = profile.full_name || "there";
    const eventTitle = reservation.event_title || "your event";
    const site = process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = site ? `${site}/account/reservations/${reservation.id}` : "";
    const codes = await buildBookingCodes(reservation);
    const reference = codes.reference;

    // Confirmation email.
    if (profile.email) {
      await sendMail({
        to: profile.email,
        subject: `Your Sining Banwa booking is confirmed — ${reference}`,
        attachments: codes.attachments,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1f1a17">
            <h2 style="color:#7a2f2f;margin:0 0 8px">Booking confirmed</h2>
            <p>Hi ${name},</p>
            <p>Your payment for <strong>${eventTitle}</strong> (${formatPeso(reservation.total_amount)}) has been verified. Your booking is now confirmed.</p>
            ${codes.html}
            <p>Show this at the entrance — staff can scan the QR or the barcode to pull up your booking.</p>
            ${link ? `<p><a href="${link}" style="color:#7a2f2f">View your booking</a></p>` : ""}
            <p style="color:#6b5e57;font-size:13px">See you at the show,<br>Sining Banwa</p>
          </div>
        `,
      });
    }

    // Confirmation SMS via UniSMS.
    if (profile.phone) {
      await sendSms({
        to: profile.phone,
        text: `Sining Banwa: Your booking ${reference} for "${eventTitle}" is CONFIRMED. Show this reference at the entrance. Salamat!`,
      });
    }
  } catch {
    // A notification failure must never affect the review outcome.
  }
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

  if (decision === "verified") {
    await notifyPaymentVerified(paymentId);
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