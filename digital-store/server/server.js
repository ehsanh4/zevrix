/* ============================================================
   ZEVRIX — Backend API + static serving
   ============================================================ */
import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import db, { productFromRow, UPLOADS_DIR } from "./src/db.js";
import { signToken, requireAuth } from "./src/auth.js";
import {
  getGatewayConfig,
  getPublicGatewayConfig,
  setSetting,
  availableMethods,
  maskCard
} from "./src/payment.js";
import {
  zarinpalEnabled,
  createZarinpalRequest,
  verifyZarinpalPayment,
  createPaymentRecord,
  getPaymentByAuthority,
  markPaymentPaid,
  markPaymentFailed,
  attachReceipt
} from "./src/zarinpal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, ".."); // digital-store/
const PORT = process.env.PORT || 4100;

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------- Static ---------- */
app.use("/admin/uploads", express.static(UPLOADS_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(ROOT)); // storefront (index.html, css/, js/)

/* ============================================================
   PUBLIC API
   ============================================================ */

/* Categories */
app.get("/api/categories", (req, res) => {
  const rows = db.prepare("SELECT * FROM categories ORDER BY sort").all();
  res.json(
    rows.map((c) => ({
      id: c.id,
      icon: c.icon,
      color: c.color,
      name: { fa: c.fa, en: c.en }
    }))
  );
});

/* Products (public — active only) */
app.get("/api/products", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC")
    .all();
  res.json(rows.map(productFromRow));
});

/* Single product */
app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(productFromRow(row));
});

/* Submit order (public) */
app.post("/api/orders", (req, res) => {
  const { customer, email, phone, items, total } = req.body || {};
  if (!customer || !email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }
  const ref = "DS-" + Date.now().toString(36).toUpperCase();
  db.prepare(
    `INSERT INTO orders (ref, customer, email, phone, total, status, items)
     VALUES (?,?,?,?,?, 'pending', ?)`
  ).run(ref, customer, email, phone || null, Number(total) || 0, JSON.stringify(items));
  res.json({ ok: true, ref });
});

/* ============================================================
   PUBLIC — PAYMENT GATEWAYS
   ============================================================ */

/* Available payment methods (public) */
app.get("/api/payment/methods", (req, res) => {
  res.json(getPublicGatewayConfig());
});

/* Start payment for an order */
app.post("/api/payment/start", async (req, res) => {
  const { ref, method } = req.body || {};
  if (!ref) return res.status(400).json({ error: "کد پیگیری الزامی است" });

  const order = db.prepare("SELECT * FROM orders WHERE ref = ?").get(ref);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد" });
  if (order.status === "paid")
    return res.status(400).json({ error: "این سفارش قبلاً پرداخت شده است" });

  const methods = availableMethods();
  if (!methods.length)
    return res.status(400).json({ error: "هیچ روش پرداختی فعال نیست" });

  const payMethod = method === "card" ? "card" : "zarinpal";
  if (!methods.includes(payMethod))
    return res.status(400).json({ error: "این روش پرداخت فعال نیست" });

  /* ---- Card to card: show card info, customer uploads receipt later ---- */
  if (payMethod === "card") {
    createPaymentRecord(order.id, "card");
    return res.json({
      ok: true,
      method: "card",
      card: getPublicGatewayConfig().card
    });
  }

  /* ---- ZarinPal: create transaction and return redirect URL ---- */
  try {
    const items = JSON.parse(order.items || "[]");
    const desc = items.length
      ? items.map((i) => i.name + (i.qty > 1 ? " ×" + i.qty : "")).join("، ")
      : order.ref;
    const { authority, payUrl } = await createZarinpalRequest(req, {
      orderId: order.id,
      amount: order.total,
      description: `سفارش ${order.ref} — ${desc}`.slice(0, 250)
    });
    createPaymentRecord(order.id, "zarinpal", { authority });
    res.json({ ok: true, method: "zarinpal", payUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Upload receipt for card-to-card payment (public, order-ref gated) */
const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, "receipt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype) || file.mimetype === "application/pdf")
      cb(null, true);
    else cb(new Error("فقط فایل تصویری یا PDF مجاز است"));
  }
});

app.post("/api/payment/receipt", receiptUpload.single("receipt"), (req, res) => {
  const ref = req.body && req.body.ref;
  if (!ref) return res.status(400).json({ error: "کد پیگیری الزامی است" });
  const order = db.prepare("SELECT * FROM orders WHERE ref = ?").get(ref);
  if (!order) return res.status(404).json({ order: null, error: "سفارش پیدا نشد" });
  if (!req.file) return res.status(400).json({ error: "فایلی ارسال نشده است" });

  const url = "/uploads/" + req.file.filename;
  attachReceipt(order.id, url, req.body.note || null);
  res.json({ ok: true, url });
});

/* ZarinPal callback (redirect from gateway) */
app.get("/api/payment/zarinpal/callback", async (req, res) => {
  const { Authority, Status } = req.query;
  const frontBase = getFrontBase(req);

  if (!Authority || Status !== "OK") {
    return res.redirect(frontBase + "/payment-result.html?status=failed");
  }

  const pay = getPaymentByAuthority(Authority);
  if (!pay) return res.redirect(frontBase + "/payment-result.html?status=failed");

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(pay.order_id);
  if (!order) return res.redirect(frontBase + "/payment-result.html?status=failed");

  try {
    const result = await verifyZarinpalPayment({ authority: Authority, amount: order.total });
    if (result.status === "paid") {
      markPaymentPaid(order.id, result.refId);
      return res.redirect(
        frontBase + "/payment-result.html?status=ok&ref=" + encodeURIComponent(order.ref) +
        "&refid=" + encodeURIComponent(result.refId)
      );
    }
    markPaymentFailed(order.id);
    return res.redirect(frontBase + "/payment-result.html?status=failed");
  } catch (err) {
    markPaymentFailed(order.id);
    return res.redirect(frontBase + "/payment-result.html?status=failed");
  }
});

/* Public: base url of the storefront for redirects */
function getFrontBase(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.connection && req.connection.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:4100";
  return proto + "://" + host;
}

/* ============================================================
   ADMIN AUTH
   ============================================================ */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است" });

  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
  }
  res.json({
    token: signToken(admin),
    admin: { id: admin.id, username: admin.username, name: admin.name }
  });
});

app.get("/api/admin/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

/* Change password */
app.put("/api/admin/password", requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 6)
    return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });

  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare("UPDATE admins SET password = ? WHERE id = ?").run(hash, req.admin.id);
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — PRODUCTS CRUD
   ============================================================ */
app.get("/api/admin/products", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.json(rows.map(productFromRow));
});

app.post("/api/admin/products", requireAuth, (req, res) => {
  const b = req.body;
  if (!b.fa || !b.en || !b.cat || !b.price) return res.status(400).json({ error: "فیلدهای الزامی ناقص است" });

  const info = db
    .prepare(
      `INSERT INTO products (fa, en, cat, icon, price, old_price, rating, reviews, sold,
                             badge_fa, badge_en, desc_fa, desc_en, specs_fa, specs_en, image, featured, active)
       VALUES (@fa,@en,@cat,@icon,@price,@old_price,@rating,@reviews,@sold,
               @badge_fa,@badge_en,@desc_fa,@desc_en,@specs_fa,@specs_en,@image,@featured,@active)`
    )
    .run({
      fa: b.fa,
      en: b.en,
      cat: b.cat,
      icon: b.icon || "📦",
      price: Number(b.price) || 0,
      old_price: b.old_price ? Number(b.old_price) : null,
      rating: Number(b.rating) || 5,
      reviews: Number(b.reviews) || 0,
      sold: Number(b.sold) || 0,
      badge_fa: b.badge_fa || null,
      badge_en: b.badge_en || null,
      desc_fa: b.desc_fa || "",
      desc_en: b.desc_en || "",
      specs_fa: JSON.stringify(b.specs_fa || []),
      specs_en: JSON.stringify(b.specs_en || []),
      image: b.image || null,
      featured: b.featured ? 1 : 0,
      active: b.active === false ? 0 : 1
    });

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put("/api/admin/products/:id", requireAuth, (req, res) => {
  const b = req.body;
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "محصول پیدا نشد" });

  db.prepare(
    `UPDATE products SET
       fa=@fa, en=@en, cat=@cat, icon=@icon, price=@price, old_price=@old_price,
       rating=@rating, reviews=@reviews, sold=@sold, badge_fa=@badge_fa, badge_en=@badge_en,
       desc_fa=@desc_fa, desc_en=@desc_en, specs_fa=@specs_fa, specs_en=@specs_en,
       image=@image, featured=@featured, active=@active
     WHERE id=@id`
  ).run({
    id: Number(req.params.id),
    fa: b.fa ?? row.fa,
    en: b.en ?? row.en,
    cat: b.cat ?? row.cat,
    icon: b.icon ?? row.icon,
    price: b.price != null ? Number(b.price) : row.price,
    old_price: b.old_price != null ? Number(b.old_price) : row.old_price,
    rating: b.rating != null ? Number(b.rating) : row.rating,
    reviews: b.reviews != null ? Number(b.reviews) : row.reviews,
    sold: b.sold != null ? Number(b.sold) : row.sold,
    badge_fa: b.badge_fa !== undefined ? b.badge_fa || null : row.badge_fa,
    badge_en: b.badge_en !== undefined ? b.badge_en || null : row.badge_en,
    desc_fa: b.desc_fa ?? row.desc_fa,
    desc_en: b.desc_en ?? row.desc_en,
    specs_fa: JSON.stringify(b.specs_fa || JSON.parse(row.specs_fa)),
    specs_en: JSON.stringify(b.specs_en || JSON.parse(row.specs_en)),
    image: b.image !== undefined ? b.image || null : row.image,
    featured: b.featured != null ? (b.featured ? 1 : 0) : row.featured,
    active: b.active != null ? (b.active ? 1 : 0) : row.active
  });

  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "محصول پیدا نشد" });
  res.json({ ok: true });
});

/* ---------- Image upload ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, "prod-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("فقط فایل تصویری مجاز است"));
  }
});

app.post("/api/admin/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی ارسال نشده است" });
  res.json({ ok: true, url: "/uploads/" + req.file.filename });
});

/* ---------- Branding (logo) ---------- */
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, "logo" + ext);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("فقط فایل تصویری مجاز است"));
  }
});

/* Public: current branding */
app.get("/api/branding", (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'logo_url'").get();
  res.json({ logoUrl: row ? row.value : null });
});

/* Admin: upload logo (replaces previous) */
app.post("/api/admin/branding/logo", requireAuth, logoUpload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی ارسال نشده است" });
  const url = "/uploads/" + req.file.filename;
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('logo_url', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(url);
  res.json({ ok: true, url });
});

/* Admin: remove logo (back to default) */
app.delete("/api/admin/branding/logo", requireAuth, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'logo_url'").get();
  if (row && row.value) {
    const f = path.join(UPLOADS_DIR, path.basename(row.value));
    fs.existsSync(f) && fs.rmSync(f, { force: true });
    db.prepare("DELETE FROM settings WHERE key = 'logo_url'").run();
  }
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — ORDERS
   ============================================================ */
app.get("/api/admin/orders", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  const pays = db
    .prepare("SELECT order_id, method, status, receipt_url, ref_id, authority FROM order_payments")
    .all()
    .reduce((m, p) => ((m[p.order_id] = p), m), {});

  res.json(
    rows.map((o) => {
      const p = pays[o.id];
      return {
        ...o,
        items: JSON.parse(o.items),
        active: undefined,
        payMethod: p ? p.method : null,
        payStatus: p ? p.status : null,
        receiptUrl: p ? p.receipt_url : null,
        refId: p ? p.ref_id : null,
        authority: p ? p.authority : null
      };
    })
  );
});

app.put("/api/admin/orders/:id/status", requireAuth, (req, res) => {
  const { status } = req.body || {};
  const allowed = ["pending", "paid", "delivered", "cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است" });

  const info = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "سفارش پیدا نشد" });
  res.json({ ok: true });
});

app.delete("/api/admin/orders/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM orders WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — PAYMENT GATEWAYS
   ============================================================ */

/* Gateway config (admin) */
app.get("/api/admin/payment/gateways", requireAuth, (req, res) => {
  res.json(getGatewayConfig());
});

/* Update gateway config (admin) */
app.put("/api/admin/payment/gateways", requireAuth, (req, res) => {
  const b = req.body || {};
  const flags = ["pg_zarinpal_enabled", "pg_zarinpal_sandbox", "pg_card_enabled"];
  const texts = [
    "pg_zarinpal_merchant", "pg_card_number", "pg_card_holder",
    "pg_card_bank", "pg_card_sheba", "pg_card_desc"
  ];

  for (const k of flags) if (b[k] !== undefined) setSetting(k, b[k] ? "1" : "0");

  for (const k of texts) {
    if (b[k] === undefined) continue;
    let v = String(b[k] || "").trim();
    if (k === "pg_card_number") v = v.replace(/\D/g, "").slice(0, 16);
    if (k === "pg_zarinpal_merchant") v = v.trim();
    setSetting(k, v);
  }

  res.json({ ok: true, config: getGatewayConfig() });
});

/* Order payment details incl. receipt (admin) */
app.get("/api/admin/orders/:id/payment", requireAuth, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد" });
  const pay = db
    .prepare("SELECT * FROM order_payments WHERE order_id = ?")
    .get(Number(req.params.id));
  res.json({ order: { id: order.id, ref: order.ref, total: order.total, status: order.status }, payment: pay || null });
});

/* Admin manually marks a card payment as paid */
app.put("/api/admin/orders/:id/verify", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد" });
  db.prepare(
    "UPDATE order_payments SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE order_id=?"
  ).run(id);
  db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(id);
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — DASHBOARD STATS
   ============================================================ */
app.get("/api/admin/stats", requireAuth, (req, res) => {
  const products = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  const active = db.prepare("SELECT COUNT(*) c FROM products WHERE active=1").get().c;
  const orders = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const revenue = db
    .prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'")
    .get().s;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status='pending'").get().c;

  const byCat = db
    .prepare(
      `SELECT cat, COUNT(*) c FROM products GROUP BY cat ORDER BY c DESC`
    )
    .all();

  res.json({ products, active, orders, revenue, pending, byCat });
});

/* ---------- Admin panel (static) ---------- */
app.use("/admin", express.static(path.join(__dirname, "public")));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---------- SPA fallback for storefront ---------- */
app.get("*", (req, res, next) => {
  const p = path.join(ROOT, req.path);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return res.sendFile(p);
  next();
});

app.listen(PORT, () => {
  console.log("🚀 ZEVRIX server running:");
  console.log("   🏪 Storefront : http://localhost:" + PORT);
  console.log("   🔐 Admin panel: http://localhost:" + PORT + "/admin");
});
