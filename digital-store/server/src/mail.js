/* ============================================================
   ZEVRIX — Email (SMTP)
   Sends transactional emails (license delivery) through SMTP.
   Settings (stored in the settings table):
     smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure
   ============================================================ */
import { getSetting } from "./payment.js";

let transporter = null;
let lastSig = "";

/** Are SMTP settings configured? */
export function smtpConfigured() {
  return !!(
    getSetting("smtp_host") &&
    getSetting("smtp_user") &&
    getSetting("smtp_pass")
  );
}

/** Signature of current settings, so we rebuild the transporter on change. */
function smtpSig() {
  return [getSetting("smtp_host"), getSetting("smtp_port"), getSetting("smtp_user")].join("|");
}

async function getTransporter() {
  if (!smtpConfigured()) return null;
  const sig = smtpSig();
  if (transporter && sig === lastSig) return transporter;

  const nodemailer = await import("nodemailer").then((m) => m.default).catch(() => null);
  if (!nodemailer) {
    console.error("[mail] nodemailer not installed — run: npm i nodemailer");
    return null;
  }

  const host = getSetting("smtp_host");
  const port = Number(getSetting("smtp_port")) || 587;
  const secure = port === 465;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: getSetting("smtp_user"), pass: getSetting("smtp_pass") },
  });
  lastSig = sig;
  return transporter;
}

/** Send a plain-text email. Returns true on success. */
export async function sendMail({ to, subject, text }) {
  if (!smtpConfigured()) {
    console.log(`[mail] skipped (no SMTP): ${to} — ${subject}`);
    return false;
  }
  try {
    const t = await getTransporter();
    if (!t) return false;
    const from =
      getSetting("smtp_from") || `"Zevrix" <${getSetting("smtp_user")}>`;
    await t.sendMail({ from, to, subject, text });
    console.log(`[mail] sent to ${to}: ${subject}`);
    return true;
  } catch (e) {
    console.error("[mail] send failed:", e.message);
    return false;
  }
}

/** SMTP keys exposed in the admin gateway/payment settings. */
export const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
];
