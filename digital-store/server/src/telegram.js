/* ============================================================
   ZEVRIX — Telegram notifier
   Sends order + receipt notifications to a Telegram chat.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { getSetting } from "./payment.js";

const TG_API = "https://api.telegram.org/bot";

/** Are Telegram credentials configured? */
export function telegramConfigured() {
  return !!(getSetting("tg_bot_token") && getSetting("tg_chat_id"));
}

/** Send a text message (best-effort, never throws) */
export async function tgText(text) {
  if (!telegramConfigured()) return false;
  try {
    const token = getSetting("tg_bot_token");
    const chatId = getSetting("tg_chat_id");
    const res = await fetch(`${TG_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

/** Send a photo with a caption (best-effort, never throws) */
export async function tgPhoto(filePath, caption) {
  if (!telegramConfigured()) return false;
  try {
    const token = getSetting("tg_bot_token");
    const chatId = getSetting("tg_chat_id");
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    const res = await fetch(`${TG_API}${token}/sendPhoto`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

/** Send a document (e.g. PDF receipt) with a caption (best-effort, never throws) */
export async function tgDocument(filePath, caption) {
  if (!telegramConfigured()) return false;
  try {
    const token = getSetting("tg_bot_token");
    const chatId = getSetting("tg_chat_id");
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    const res = await fetch(`${TG_API}${token}/sendDocument`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

/** Notify about a new order (any method) */
export async function notifyNewOrder(order, methodLabel) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const lines = items
    .map((it) => `• ${it.name || "محصول"} ×${it.qty}`)
    .join("\n");
  const text =
    `🛒 <b>سفارش جدید</b>\n\n` +
    `کد پیگیری: <code>${order.ref}</code>\n` +
    `روش پرداخت: <b>${methodLabel}</b>\n` +
    `مبلغ: <b>${Number(order.total).toLocaleString("fa-IR")} تومان</b>\n` +
    (order.email ? `ایمیل: <code>${order.email}</code>\n` : "") +
    (order.customer ? `مشتری: ${order.customer}\n` : "") +
    (lines ? `\n<b>اقلام:</b>\n${lines}` : "");
  return tgText(text);
}

/** Notify about an uploaded card-to-card receipt, with the receipt photo */
export async function notifyReceipt(order, receiptPath, note) {
  const caption =
    `🧾 <b>رسید کارت به کارت</b>\n\n` +
    `کد پیگیری: <code>${order.ref}</code>\n` +
    `مبلغ: <b>${Number(order.total).toLocaleString("fa-IR")} تومان</b>\n` +
    (order.email ? `ایمیل: <code>${order.email}</code>\n` : "") +
    (note ? `یادداشت: ${note}\n` : "") +
    `\n✅ در پنل ادمین تأیید کنید`;
  return tgPhoto(receiptPath, caption);
}
