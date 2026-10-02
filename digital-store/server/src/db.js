/* ============================================================
   ZEVRIX — Database schema & connection (SQLite)
   Uses Node's built-in `node:sqlite` (Node >= 22.5 / 24+).
   ============================================================ */
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, "store.db");
export const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

/* ---------- Schema ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  name          TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,
  icon  TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#6d5dfc',
  fa    TEXT NOT NULL,
  en    TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fa         TEXT NOT NULL,
  en         TEXT NOT NULL,
  cat        TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📦',
  price      INTEGER NOT NULL,
  old_price  INTEGER,
  rating     REAL NOT NULL DEFAULT 5,
  reviews    INTEGER NOT NULL DEFAULT 0,
  sold       INTEGER NOT NULL DEFAULT 0,
  badge_fa   TEXT,
  badge_en   TEXT,
  desc_fa    TEXT NOT NULL DEFAULT '',
  desc_en    TEXT NOT NULL DEFAULT '',
  specs_fa   TEXT NOT NULL DEFAULT '[]',
  specs_en   TEXT NOT NULL DEFAULT '[]',
  image      TEXT,
  featured   INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cat) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref        TEXT NOT NULL UNIQUE,
  customer   TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  total      INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  items      TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

/* Payment method chosen by the customer at checkout */
CREATE TABLE IF NOT EXISTS order_payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL UNIQUE,
  method        TEXT NOT NULL,              -- 'zarinpal' | 'card'
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  authority     TEXT,                       -- ZarinPal authority code
  ref_id        TEXT,                       -- ZarinPal reference id (after verify)
  receipt_url   TEXT,                       -- uploaded receipt file (card method)
  payer_note    TEXT,                       -- note from customer (card method)
  paid_at       DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/* ---------- Payment gateway settings (key/value in `settings`) ----------
   pg_zarinpal_enabled   : '0' | '1'
   pg_zarinpal_merchant  : merchant code (UUID)
   pg_zarinpal_sandbox   : '0' | '1'
   pg_card_enabled       : '0' | '1'
   pg_card_number        : 16-digit card number
   pg_card_holder        : card holder name
   pg_card_bank          : bank name
   pg_card_sheba         : IR sheba number
   pg_card_desc          : extra note shown to customer
*/

/* ---------- Helpers ---------- */
export function productFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: { fa: r.fa, en: r.en },
    cat: r.cat,
    icon: r.icon,
    image: r.image || null,
    price: r.price,
    oldPrice: r.old_price,
    rating: r.rating,
    reviews: r.reviews,
    sold: r.sold,
    badge: r.badge_fa || r.badge_en ? { fa: r.badge_fa, en: r.badge_en } : null,
    desc: { fa: r.desc_fa, en: r.desc_en },
    specs: { fa: JSON.parse(r.specs_fa || "[]"), en: JSON.parse(r.specs_en || "[]") },
    featured: !!r.featured,
    active: !!r.active
  };
}

export default db;
