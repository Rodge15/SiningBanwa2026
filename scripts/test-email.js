// Standalone SMTP test. Run it from the project root:
//
//   node scripts/test-email.js you@example.com
//
// It reads SMTP_* from .env.local, verifies the connection, then sends one test
// email to the address you pass. No dev server needed.

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// Minimal .env.local loader (so we don't need the dotenv package).
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

async function main() {
  loadEnvLocal();

  const to = process.argv[2];
  if (!to) {
    console.error("Usage: node scripts/test-email.js <recipient@example.com>");
    process.exit(1);
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    console.error("Missing SMTP settings. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.");
    process.exit(1);
  }

  console.log(`SMTP host: ${host}:${port} (secure: ${port === 465})`);
  console.log(`From:      ${from}`);
  console.log(`To:        ${to}`);

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  process.stdout.write("Verifying connection... ");
  await transport.verify();
  console.log("OK");

  process.stdout.write("Sending test email... ");
  const info = await transport.sendMail({
    from,
    to,
    subject: "Sining Banwa SMTP test",
    text: "This is a test email from the Sining Banwa event system. SMTP is working.",
    html: "<p>This is a test email from the <strong>Sining Banwa</strong> event system.</p><p>SMTP is working. ✅</p>",
  });
  console.log("sent. Message id:", info.messageId);
  console.log("\nSuccess — check the inbox for", to);
}

main().catch((error) => {
  console.error("\nFAILED:", error.message);
  console.error(
    "\nCommon fixes:\n" +
      " - Gmail: use a 16-character App Password (not your login password), 2FA must be on.\n" +
      " - Check SMTP_HOST=smtp.gmail.com and SMTP_PORT=465.\n" +
      " - If you see 'Invalid login', the user or app password is wrong."
  );
  process.exit(1);
}); 