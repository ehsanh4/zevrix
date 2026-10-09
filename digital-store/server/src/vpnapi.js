/* ============================================================
   ZEVRIX — ShopVPN Integration API client
   Connects to a ShopVPN panel (github.com/mehdirafatpanah/Shopvpn)
   and pulls its product catalog into the ZEVRIX store.

   ShopVPN Integration API:
     POST {base_url}/api   { "action": "products", "limit": 100, "offset": 0 }
     Auth header:  Token: <token>   (created with the /token2 bot command)
     Response:     { "status": true, "msg": "ok", "obj": [ ...products ] }
   ============================================================ */
import db from "./db.js";
import { getSetting, setSetting } from "./payment.js";

export const VPN_KEYS = [
  "vpn_enabled",
  "vpn_api_url",
  "vpn_api_token",
  "vpn_cat",
  "vpn_sync_interval"
];

/* Sync state (kept in the settings table so it survives restarts) */
const STATE_KEYS = {
  lastSync: "vpn_last_sync",
  lastStatus: "vpn_last_status",
  lastCount: "vpn_last_count",
  lastError: "vpn_last_error"
};

/** Is the integration configured (url + token present)? */
export function vpnConfigured() {
  return !!(getSetting("vpn_api_url") && getSetting("vpn_api_token"));
}

/** Is the integration turned on AND configured? */
export function vpnEnabled() {
  return getSetting("vpn_enabled") === "1" && vpnConfigured();
}

/** Full VPN config, safe to send to the admin panel */
export function getVpnConfig() {
  const cfg = {};
  for (const k of VPN_KEYS) cfg[k] = getSetting(k);
  cfg[STATE_KEYS.lastSync] = getSetting(STATE_KEYS.lastSync);
  cfg[STATE_KEYS.lastStatus] = getSetting(STATE_KEYS.lastStatus);
  cfg[STATE_KEYS.lastCount] = getSetting(STATE_KEYS.lastCount);
  cfg[STATE_KEYS.lastError] = getSetting(STATE_KEYS.lastError);
  return cfg;
}

/** Public config (no secrets) — tells the storefront the integration is live */
export function getPublicVpnConfig() {
  return { enabled: vpnEnabled() };
}

/* ---------- HTTP ---------- */

/** Call the ShopVPN Integration API with the given action. */
export async function vpnRequest(action, params = {}, { url, token } = {}) {
  const baseUrl = (url || getSetting("vpn_api_url") || "").trim().replace(/\/+$/, "");
  const tok = token || getSetting("vpn_api_token");
  if (!baseUrl) throw new Error("آدرس API پنل VPN تنظیم نشده است");
  if (!tok) throw new Error("توکن API پنل VPN تنظیم نشده است");

  let res;
  try {
    res = await fetch(`${baseUrl}/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Token: tok,
        Accept: "application/json"
      },
      body: JSON.stringify({ action, limit: 100, offset: 0, ...params })
    });
  } catch (e) {
    throw new Error("اتصال به پنل VPN برقرار نشد — آدرس را بررسی کنید");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("توکن نامعتبر است یا دسترسی لازم را ندارد");
  }
  if (!res.ok) throw new Error(`پنل VPN خطای HTTP ${res.status} برگرداند`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("پاسخ پنل VPN قابل خواندن نیست (JSON نیست)");
  }

  if (!data || data.status !== true) {
    throw new Error((data && (data.msg || data.error)) || "پنل VPN پاسخ نامعتبری داد");
  }
  return data.obj ?? [];
}

/* ---------- Mapping ---------- */

/**
 * Map a ShopVPN product to the ZEVRIX storefront shape.
 * ShopVPN fields: id, name, category_id, category_name, price, duration_days,
 *                 description, is_active, is_auto_provision, provision_server_id
 */
export function mapVpnProduct(p) {
  const days = Number(p.duration_days || 0);
  const dur =
    days >= 365 && days % 365 === 0
      ? `${days / 365} ساله`
      : days >= 30 && days % 30 === 0
      ? `${days / 30} ماهه`
      : days > 0
      ? `${days} روزه`
      : "";

  const desc = String(p.description || "").trim();
  const specs = [dur && `مدت اعتبار: ${dur}`, p.category_name && `دسته: ${p.category_name}`]
    .filter(Boolean)
    .map((s) => `✅ ${s}`);

  return {
    remote_id: Number(p.id),
    name: String(p.name || `VPN-${p.id}`),
    category_name: String(p.category_name || ""),
    price: Math.round(Number(p.price || 0)),
    duration_days: days,
    description: desc,
    is_active: p.is_active !== false && p.is_active !== 0,
    is_auto_provision: !!(p.is_auto_provision || p.provision_server_id)
  };
}

/* ---------- Sync ---------- */

/**
 * Pull products from the ShopVPN panel and store them locally.
 * Returns { count, products } on success; throws on failure.
 */
export async function syncVpnProducts() {
  if (!vpnConfigured()) throw new Error("ابتدا آدرس و توکن API را تنظیم کنید");

  const raw = await vpnRequest("products", { limit: 200, offset: 0 });
  const items = (Array.isArray(raw) ? raw : []).map(mapVpnProduct);

  const upsert = db.prepare(`
    INSERT INTO vpn_products
      (remote_id, name, category_name, price, duration_days, description,
       is_active, is_auto_provision, updated_at)
    VALUES (?,?,?,?,?,?,?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(remote_id) DO UPDATE SET
      name=excluded.name,
      category_name=excluded.category_name,
      price=excluded.price,
      duration_days=excluded.duration_days,
      description=excluded.description,
      is_active=excluded.is_active,
      is_auto_provision=excluded.is_auto_provision,
      updated_at=CURRENT_TIMESTAMP
  `);

  const ids = items.map((i) => i.remote_id);
  const placeholders = ids.map(() => "?").join(",");
  const dropMissing = db.prepare(
    `DELETE FROM vpn_products ${ids.length ? `WHERE remote_id NOT IN (${placeholders})` : ""}`
  );

  db.exec("BEGIN");
  try {
    for (const it of items) {
      upsert.run(
        it.remote_id,
        it.name,
        it.category_name,
        it.price,
        it.duration_days,
        it.description,
        it.is_active ? 1 : 0,
        it.is_auto_provision ? 1 : 0
      );
    }
    dropMissing.run(...ids);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  setSetting(STATE_KEYS.lastSync, new Date().toISOString());
  setSetting(STATE_KEYS.lastStatus, "ok");
  setSetting(STATE_KEYS.lastCount, String(items.length));
  setSetting(STATE_KEYS.lastError, "");

  return { count: items.length, products: items };
}

/** Record a failed sync attempt (best-effort, never throws). */
export function recordSyncError(message) {
  setSetting(STATE_KEYS.lastSync, new Date().toISOString());
  setSetting(STATE_KEYS.lastStatus, "error");
  setSetting(STATE_KEYS.lastError, String(message || "خطای ناشناخته").slice(0, 500));
}

/**
 * Products pulled from the panel, converted to the ZEVRIX storefront shape
 * (same structure as /api/products) so the storefront renders them unchanged.
 */
export function vpnStoreProducts() {
  const cat = getSetting("vpn_cat") || "vpn";
  const rows = db
    .prepare("SELECT * FROM vpn_products WHERE is_active = 1 ORDER BY price ASC")
    .all();

  return rows.map((r) => ({
    id: "vpn-" + r.remote_id, // string id → can never collide with DB product ids
    name: { fa: r.name, en: r.name },
    cat,
    icon: "🌐",
    image: null,
    price: r.price,
    oldPrice: null,
    rating: 5,
    reviews: 0,
    sold: 0,
    badge: { fa: "VPN", en: "VPN" },
    desc: {
      fa: r.description || `${r.name} — اشتراک VPN`,
      en: r.description || `${r.name} — VPN subscription`
    },
    specs: {
      fa: r.duration_days
        ? [`✅ مدت اعتبار: ${r.duration_days} روز`]
        : ["✅ تحویل آنی پس از پرداخت"],
      en: r.duration_days
        ? [`✅ Duration: ${r.duration_days} days`]
        : ["✅ Instant delivery after payment"]
    },
    featured: false,
    active: true,
    isVpn: true
  }));
}

/** Background sync loop — runs forever, logs failures, never throws. */
export async function vpnSyncLoop() {
  const tick = async () => {
    if (!vpnEnabled()) return;
    try {
      await syncVpnProducts();
    } catch (e) {
      recordSyncError(e.message);
    }
  };

  // first run shortly after boot (lets the server start serving first)
  setTimeout(tick, 3000);

  // then on a fixed cadence (default 30 minutes)
  const intervalMs = Math.max(5, Number(getSetting("vpn_sync_interval") || 30)) * 60 * 1000;
  setInterval(tick, intervalMs);
}
