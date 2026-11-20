// Standalone UniSMS test. Run from the project root:
//
//   node scripts/test-sms.js 09171234567
//
// It reads UNISMS_* from .env.local and sends one test SMS. No dev server needed.

const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) {
    return;
  }
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function normalizePhone(raw) {
  const cleaned = String(raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("63")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+63${cleaned.slice(1)}`;
  if (cleaned.length === 10 && cleaned.startsWith("9")) return `+63${cleaned}`;
  return `+${cleaned}`;
}

async function main() {
  loadEnvLocal();

  const to = normalizePhone(process.argv[2]);
  if (!to) {
    console.error("Usage: node scripts/test-sms.js <phone, e.g. 09171234567>");
    process.exit(1);
  }

  const secretKey = process.env.UNISMS_SECRET_KEY || "";
  const senderId = process.env.UNISMS_SENDER_ID || "";

  if (!secretKey) {
    console.error("Missing UNISMS_SECRET_KEY in .env.local.");
    process.exit(1);
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  const payload = { recipient: to, content: "Sining Banwa SMS test. If you received this, UniSMS is working." };
  if (senderId) {
    payload.sender_id = senderId;
  }

  console.log(`Sender ID: ${senderId || "(none set)"}`);
  console.log(`To:        ${to}`);
  process.stdout.write("Sending... ");

  const res = await fetch("https://unismsapi.com/api/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (res.ok) {
    console.log("\nSuccess — check the phone", to);
  } else {
    console.log("\nFAILED — see the response above. Common causes: wrong secret key,");
    console.log("an unapproved Sender ID, or the number not in +63 format.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nFAILED:", error.message);
  process.exit(1);
});