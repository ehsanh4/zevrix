/* ============================================================
   ZEVRIX — License key fulfillment
   Assigns unused license keys to a paid order and delivers them
   to the customer by email (and mirrors them to Telegram).
   ============================================================ */
import db from "./db.js";
import { telegramConfigured, tgText } from "./telegram.js";
import { sendMail, smtpConfigured } from "./mail.js";

/** Return the list of products in an order (from the JSON items column). */
function orderProducts(order) {
  let items = [];
  try {
    items = JSON.parse(order.items || "[]");
  } catch {
    items = [];
  }
  return items
    .filter((i) => i && i.id != null)
    .map((i) => ({ id: Number(i.id), qty: Math.max(1, Number(i.qty) || 1) }));
}

/** Has this order already had its keys delivered? */
export function orderDelivered(orderId) {
  const row = db
    .prepare("SELECT delivered_at FROM orders WHERE id = ?")
    .get(orderId);
  return !!(row && row.delivered_at);
}

/**
 * Assign unused keys to every item in the order.
 * Returns { delivered: [{productId, name, keys:[]}], missing: [{productId, name, qty}] }
 */
export function assignKeys(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { delivered: [], missing: [] };

  const products = orderProducts(order);
  const delivered = [];
  const missing = [];

  const takeKey = db.prepare(
    `SELECT id, key_text FROM license_keys
     WHERE product_id = ? AND status = 'available'
     ORDER BY id ASC LIMIT 1`
  );
  const markSold = db.prepare(
    `UPDATE license_keys SET status = 'sold', order_id = ?, sold_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  );
  const prodName = db.prepare("SELECT fa FROM products WHERE id = ?");

  db.exec("BEGIN");
  try {
    for (const p of products) {
      const keys = [];
      for (let n = 0; n < p.qty; n++) {
        const k = takeKey.get(p.id);
        if (!k) break;
        markSold.run(orderId, k.id);
        keys.push(k.key_text);
      }
      const nm = prodName.get(p.id);
      const name = nm ? nm.fa : `#${p.id}`;
      if (keys.length) delivered.push({ productId: p.id, name, keys });
      if (keys.length < p.qty)
        missing.push({ productId: p.id, name, qty: p.qty - keys.length });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { delivered, missing };
}

/** Plain-text list of keys for the customer. */
function keysToText(delivered) {
  return delivered
    .map((d) => `▸ ${d.name}\n${d.keys.map((k) => `   ${k}`).join("\n")}`)
    .join("\n\n");
}

/** Send the keys to the customer by email (best-effort). */
async function emailKeys(order, delivered) {
  if (!smtpConfigured()) return false;
  const subject = `لایسنس خرید شما | ${order.ref}`;
  const body = `سلام ${order.customer} عزیز،

خرید شما با کد سفارش ${order.ref} تایید شد و لایسنس‌های شما آماده است:

${keysToText(delivered)}

موفق باشید — زوریکس
https://www.zevrix.ir`;
  return sendMail({ to: order.email, subject, text: body });
}

/**
 * Full fulfillment: assign keys, email the customer, mirror to Telegram.
 * Safe to call multiple times — a delivered order is never re-processed.
 */
export async function deliverOrder(orderId) {
  if (orderDelivered(orderId)) return { ok: true, already: true };

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { ok: false, error: "order not found" };

  const { delivered, missing } = assignKeys(orderId);
  if (!delivered.length) {
    return {
      ok: false,
      error: "no keys available",
      missing,
    };
  }

  db.prepare("UPDATE orders SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    orderId
  );

  const emailed = await emailKeys(order, delivered);

  if (telegramConfigured()) {
    const lines = [
      `✅ <b>تحویل لایسنس</b> — سفارش <code>${order.ref}</code>`,
      `👤 ${esc(order.customer)} — ${esc(order.email || "")}`,
      "",
      `<b>لایسنس‌های ارسال شده:</b>`,
      esc(keysToText(delivered)),
    ];
    if (missing.length) {
      lines.push(
        "",
        `⚠️ <b>نقص موجودی:</b> ${missing
          .map((m) => `${esc(m.name)} (${m.qty})`)
          .join("، ")}`
      );
    }
    await tgText(lines.join("\n")).catch(() => {});
  }

  return { ok: true, delivered, missing, emailed };
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
