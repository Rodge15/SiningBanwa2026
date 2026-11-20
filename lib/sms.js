// UniSMS (unismsapi.com) text sender.
// Auth: HTTP Basic, with the API secret key as the username and an empty
// password -> Authorization: Basic base64("SECRET_KEY:").
// Env:
//   UNISMS_SECRET_KEY - your API secret key (sk_...)
//   UNISMS_SENDER_ID  - your approved Sender ID
const ENDPOINT = "https://unismsapi.com/api/sms";

function readConfig() {
  return {
    secretKey: process.env.UNISMS_SECRET_KEY || "",
    senderId: process.env.UNISMS_SENDER_ID || "",
  };
}

export function isSmsConfigured() {
  return Boolean(readConfig().secretKey);
}

// Normalize a Philippine mobile number to E.164 (+63XXXXXXXXXX).
// Accepts 09171234567, 639171234567, +639171234567, 9171234567.
export function normalizePhone(raw) {
  const cleaned = String(raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) {
    return "";
  }
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("63")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0")) {
    return `+63${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith("9")) {
    return `+63${cleaned}`;
  }
  return `+${cleaned}`;
}

// Sends an SMS. Never throws: returns { ok } or { ok: false, error } so a text
// failure can never break the booking or review flow.
export async function sendSms({ to, text }) {
  const { secretKey, senderId } = readConfig();

  if (!secretKey) {
    return { ok: false, error: "UniSMS is not configured." };
  }

  const recipient = normalizePhone(to);
  if (!recipient) {
    return { ok: false, error: "No phone number." };
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  const payload = { recipient, content: text };
  if (senderId) {
    payload.sender_id = senderId;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data?.message || data?.error || `UniSMS error (HTTP ${res.status}).` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The SMS could not be sent." };
  }
}