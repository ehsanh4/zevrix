/* ============================================================
   ZEVRIX — Seed database (admin + categories + products)
   ============================================================ */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import db, { productFromRow } from "./src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_JS = path.join(__dirname, "..", "js", "data.js");

/* Load CATEGORIES & PRODUCTS from the storefront data.js (non-module file) */
function loadStoreData() {
  const src = fs.readFileSync(DATA_JS, "utf-8");
  const fn = new Function(src + "\nreturn { CATEGORIES, PRODUCTS };");
  return fn();
}

const { CATEGORIES, PRODUCTS } = loadStoreData();

/* ---------- Admin ---------- */
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin12345";

const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(ADMIN_USER);
if (!existing) {
  db.prepare("INSERT INTO admins (username, password, name) VALUES (?,?,?)").run(
    ADMIN_USER,
    bcrypt.hashSync(ADMIN_PASS, 10),
    "مدیر فروشگاه"
  );
  console.log("✅ Admin created:", ADMIN_USER, "/", ADMIN_PASS);
} else {
  console.log("ℹ️  Admin already exists:", ADMIN_USER);
}

/* ---------- Categories ---------- */
const catStmt = db.prepare(
  "INSERT INTO categories (id, icon, color, fa, en, sort) VALUES (?,?,?,?,?,?) " +
    "ON CONFLICT(id) DO UPDATE SET icon=excluded.icon, color=excluded.color, fa=excluded.fa, en=excluded.en"
);
const catFa = {
  software: "نرم‌افزار",
  vpn: "VPN",
  ai: "هوش مصنوعی",
  sub: "اشتراک‌ها",
  games: "بازی",
  files: "فایل‌ها",
  security: "امنیت",
  productivity: "بهره‌وری"
};
const catEn = {
  software: "Software",
  vpn: "VPN",
  ai: "AI Tools",
  sub: "Subscriptions",
  games: "Games",
  files: "Files",
  security: "Security",
  productivity: "Productivity"
};
CATEGORIES.forEach((c, i) => catStmt.run(c.id, c.icon, c.color, catFa[c.id], catEn[c.id], i));
console.log(`✅ ${CATEGORIES.length} categories synced`);

/* ---------- Products ---------- */
const prodStmt = db.prepare(
  `INSERT INTO products (fa, en, cat, icon, price, old_price, rating, reviews, sold,
                         badge_fa, badge_en, desc_fa, desc_en, specs_fa, specs_en, featured, active)
   VALUES (@fa,@en,@cat,@icon,@price,@old_price,@rating,@reviews,@sold,
           @badge_fa,@badge_en,@desc_fa,@desc_en,@specs_fa,@specs_en,@featured,1)
   ON CONFLICT(id) DO UPDATE SET
     fa=@fa, en=@en, cat=@cat, icon=@icon, price=@price, old_price=@old_price,
     rating=@rating, reviews=@reviews, sold=@sold, badge_fa=@badge_fa, badge_en=@badge_en,
     desc_fa=@desc_fa, desc_en=@desc_en, specs_fa=@specs_fa, specs_en=@specs_en, featured=@featured`
);

const clearProds = db.prepare("DELETE FROM products");
clearProds.run();

PRODUCTS.forEach((p) => {
  prodStmt.run({
    fa: p.name.fa,
    en: p.name.en,
    cat: p.cat,
    icon: p.icon,
    price: p.price,
    old_price: p.oldPrice ?? null,
    rating: p.rating,
    reviews: p.reviews,
    sold: p.sold,
    badge_fa: p.badge?.fa ?? null,
    badge_en: p.badge?.en ?? null,
    desc_fa: p.desc.fa,
    desc_en: p.desc.en,
    specs_fa: JSON.stringify(p.specs.fa),
    specs_en: JSON.stringify(p.specs.en),
    featured: p.featured ? 1 : 0
  });
});
console.log(`✅ ${PRODUCTS.length} products synced`);

/* ---------- Settings ---------- */
db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name','ZEVRIX')"
).run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('usd_rate','62000')").run();

const count = db.prepare("SELECT COUNT(*) c FROM products").get();
console.log("📦 Products in DB:", count.c);
console.log("🌐 Admin login: http://localhost:4100/admin  →", ADMIN_USER, "/", ADMIN_PASS);
process.exit(0);
