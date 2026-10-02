/* ============================================================
   ZEVRIX — ZarinPal payment gateway
   Docs: https://www.zarinpal.com/docs/apiDocs/
   ------------------------------------------------------------
   Flow:
   1) POST https://api.zarinpal.com/pg/v4/payment/request.json
      { merchant_id, amount, callback_url, description, order_id }
      -> { data: { authority, code: 100 } }
      -> redirect to https://www.zarinpal.com/pg/StartPay/{authority}
   2) Callback: ?Authority=...&Status=OK
      POST https://api.zarinpal.com/pg/v4/payment/verify.json
      { merchant_id, amount, authority }
      -> { data: { code: 100, ref_id, ... } }
   Sandbox: use https://sandbox.zarinpal.com/pg/v4/... and
            https://sandbox.zarinpal.com/pg/StartPay/{authority}
   ============================================================ */
import db from "./db.js";
import { getSetting } from "./payment.js";

const API_VERSION = "v4";
const ENDPOINTS = {
  live: {
    request: "https://api.zarinpal.com/pg/v4/payment/request.json",
    verify: "https://api.zarinpal.com/pg/v4/payment/verify.json",
    pay: "https://www.zarinpal.com/pg/StartPay/{authority}"
  },
  sandbox: {
    request: "https://sandbox.zarinpal.com/pg/v4/payment/request.json",
    verify: "https://sandbox.zarinpal.com/pg/v4/payment/verify.json",
    pay: "https://sandbox.zarinpal.com/pg/StartPay/{authority}"
  }
};

function endpoints() {
  return getSetting("pg_zarinpal_sandbox") === "1" ? ENDPOINTS.sandbox : ENDPOINTS.live;
}

export function zarinpalConfigured() {
  return !!getSetting("pg_zarinpal_merchant");
}

export function zarinpalEnabled() {
  return getSetting("pg_zarinpal_enabled") === "1" && zarinpalConfigured();
}

/** Public callback URL for this server (derived from Host header) */
function callbackUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.connection && req.connection.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}/api/payment/zarinpal/callback`;
}

/**
 * Create a ZarinPal payment request.
 * @returns { authority, payUrl }
 */
export async function createZarinpalRequest(req, { orderId, amount, description }) {
  const merchantId = getSetting("pg_zarinpal_merchant");
  if (!merchantId) throw new Error("درگاه زرین‌پال پیکربندی نشده است");

  const body = {
    merchant_id: merchantId,
    amount: Math.round(Number(amount)), // toman, integer
    callback_url: callbackUrl(req),
    description: description || `سفارش ${orderId}`,
    order_id: String(orderId)
  };

  const res = await fetch(endpoints().request, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });

  let data = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-json error */ }
  }

  const authority = data && data.data && data.data.authority;
  if (!res.ok || !authority) {
    const msg = (data && (data.message || (data.errors && JSON.stringify(data.errors)))) || `HTTP ${res.status}`;
    throw new Error("خطا در ارتباط با زرین‌پال: " + msg);
  }

  return {
    authority,
    payUrl: endpoints().pay.replace("{authority}", authority)
  };
}

/**
 * Verify a ZarinPal payment on callback.
 * @returns { refId, status }
 */
export async function verifyZarinpalPayment({ authority, amount }) {
  const merchantId = getSetting("pg_zarinpal_merchant");
  if (!merchantId) throw new Error("درگاه زرین‌پال پیکربندی نشده است");

  const res = await fetch(endpoints().verify, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ merchant_id: merchantId, amount: Math.round(Number(amount)), authority })
  });

  let data = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-json error */ }
  }

  const code = data && data.data && data.data.code;
  if (res.ok && code === 100) {
    return { refId: String(data.data.ref_id || ""), status: "paid", raw: data.data };
  }

  const msg = (data && (data.message || (data.errors && JSON.stringify(data.errors)))) || `HTTP ${res.status}`;
  return { refId: null, status: "failed", message: msg, raw: data };
}

/* ---------- order payment records ---------- */

export function createPaymentRecord(orderId, method, extra = {}) {
  db.prepare(
    `INSERT INTO order_payments (order_id, method, status, authority, receipt_url, payer_note)
     VALUES (?, ?, 'pending', ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET
       method=excluded.method, status='pending',
       authority=excluded.authority, receipt_url=excluded.receipt_url, payer_note=excluded.payer_note`
  ).run(orderId, method, extra.authority || null, extra.receiptUrl || null, extra.note || null);
}

export function getPaymentByOrderId(orderId) {
  return db.prepare("SELECT * FROM order_payments WHERE order_id = ?").get(orderId);
}

export function getPaymentByAuthority(authority) {
  return db.prepare("SELECT * FROM order_payments WHERE authority = ?").get(authority);
}

export function markPaymentPaid(orderId, refId) {
  db.prepare(
    "UPDATE order_payments SET status='paid', ref_id=?, paid_at=CURRENT_TIMESTAMP WHERE order_id=?"
  ).run(String(refId || ""), orderId);
  db.prepare("UPDATE orders SET status='paid' WHERE id=? AND status='pending'").run(orderId);
}

export function markPaymentFailed(orderId) {
  db.prepare("UPDATE order_payments SET status='failed' WHERE order_id=?").run(orderId);
}

export function attachReceipt(orderId, receiptUrl, note) {
  const exists = db.prepare("SELECT 1 FROM order_payments WHERE order_id = ?").get(orderId);
  if (exists) {
    db.prepare(
      "UPDATE order_payments SET receipt_url=?, payer_note=? WHERE order_id=?"
    ).run(receiptUrl, note || null, orderId);
  } else {
    db.prepare(
      "INSERT INTO order_payments (order_id, method, status, receipt_url, payer_note) VALUES (?,?,?,?,?)"
    ).run(orderId, "card", "pending", receiptUrl, note || null);
  }
}
