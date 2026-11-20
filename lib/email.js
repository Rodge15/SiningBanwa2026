import nodemailer from "nodemailer";

// Reads SMTP settings from the environment. For Gmail use:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=<16-character Google App Password, not your normal password>
//   SMTP_FROM="Sining Banwa <you@gmail.com>"
function readConfig() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || user;

  return { host, port, user, pass, from };
}

export function isEmailConfigured() {
  const { host, user, pass } = readConfig();
  return Boolean(host && user && pass);
}

// Port 465 uses implicit TLS (secure). 587 uses STARTTLS (secure: false).
function createTransport() {
  const { host, port, user, pass } = readConfig();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// Verifies the SMTP credentials and connection without sending a message.
// Returns { ok: true } or { ok: false, error }.
export async function verifyEmail() {
  if (!isEmailConfigured()) {
    return { ok: false, error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS." };
  }

  try {
    await createTransport().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "SMTP connection failed." };
  }
}

// Sends an email. Never throws: on any problem it returns { ok: false, error }
// so a failed email can never break the booking or payment flow.
// `attachments` is passed straight to nodemailer (use { filename, content, cid }
// to embed an image referenced in the HTML as <img src="cid:...">).
export async function sendMail({ to, subject, html, text, attachments }) {
  if (!isEmailConfigured()) {
    return { ok: false, error: "SMTP is not configured." };
  }

  if (!to) {
    return { ok: false, error: "No recipient address." };
  }

  const { from } = readConfig();

  try {
    const info = await createTransport().sendMail({
      from,
      to,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, " ") : ""),
      html,
      attachments: attachments || undefined,
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The email could not be sent." };
  }
}