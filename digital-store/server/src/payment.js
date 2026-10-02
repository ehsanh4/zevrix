/* ============================================================
   ZEVRIX — Payment gateway settings helpers
   Gateway config is stored as key/value rows in `settings`.
   ============================================================ */
import db from "./db.js";

export const PG_KEYS = [
  "pg_zarinpal_enabled",
  "pg_zarinpal_merchant",
  "pg_zarinpal_sandbox",
  "pg_card_enabled",
  "pg_card_number",
  "pg_card_holder",
  "pg_card_bank",
  "pg_card_sheba",
  "pg_card_desc",
  "tg_bot_token",
  "tg_chat_id"
];

const DEFAULTS = {
  pg_zarinpal_enabled: "0",
  pg_zarinpal_merchant: "",
  pg_zarinpal_sandbox: "0",
  pg_card_enabled: "0",
  pg_card_number: "",
  pg_card_holder: "",
  pg_card_bank: "",
  pg_card_sheba: "",
  pg_card_desc: "",
  tg_bot_token: "",
  tg_chat_id: ""
};

/** Read one setting (falls back to default) */
export function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : DEFAULTS[key] ?? null;
}

/** Write one setting */
export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, String(value ?? ""));
}

/** Full gateway config, safe to send to the admin panel */
export function getGatewayConfig() {
  const cfg = {};
  for (const k of PG_KEYS) cfg[k] = getSetting(k);
  return cfg;
}

/** Public config: everything except the merchant code */
export function getPublicGatewayConfig() {
  return {
    zarinpal: { enabled: getSetting("pg_zarinpal_enabled") === "1" },
    card: {
      enabled: getSetting("pg_card_enabled") === "1",
      number: getSetting("pg_card_number") || "",
      holder: getSetting("pg_card_holder") || "",
      bank: getSetting("pg_card_bank") || "",
      sheba: getSetting("pg_card_sheba") || "",
      desc: getSetting("pg_card_desc") || ""
    }
  };
}

/** Which methods are currently available to customers */
export function availableMethods() {
  const list = [];
  if (getSetting("pg_zarinpal_enabled") === "1") list.push("zarinpal");
  if (getSetting("pg_card_enabled") === "1") list.push("card");
  return list;
}

/** Mask a card number for display: 1234-****-****-5678 */
export function maskCard(num) {
  const s = String(num || "").replace(/\D/g, "");
  if (s.length < 8) return s;
  return s.slice(0, 4) + "-****-****-" + s.slice(-4);
}
