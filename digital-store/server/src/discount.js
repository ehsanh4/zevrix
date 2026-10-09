/* ============================================================
   ZEVRIX — Discount codes
   Model mirrors the ShopVPN bot: percent takes precedence over
   fixed_amount, the discount never exceeds the price, and
   max_discount_amount caps only the percent case.
   ============================================================ */
import db from "./db.js";

/* Codes are stored upper-cased, exactly like the bot does. */
export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/* Percent takes precedence over fixed_amount; the discount never
   exceeds the price itself. */
export function computeDiscountAmount(row, price) {
  if (!row) return 0;
  const p = Math.max(0, Number(price) || 0);
  if (row.percent) {
    let amount = Math.floor((p * Number(row.percent)) / 100);
    if (row.max_discount_amount)
      amount = Math.min(amount, Number(row.max_discount_amount));
    return Math.min(amount, p);
  }
  if (row.fixed_amount) return Math.min(Number(row.fixed_amount), p);
  return 0;
}

/* Human-readable reason when a code cannot be used, or null when it
   is valid — same order of checks as the bot. */
export function discountInvalidReason(row, price) {
  if (!row) return "کد تخفیف یافت نشد.";
  if (!row.is_active) return "این کد تخفیف غیرفعال است.";
  if (row.max_uses && row.used_count >= row.max_uses)
    return "سقف استفاده از این کد تخفیف تمام شده است.";
  if (row.expires_at && new Date().toISOString() > row.expires_at)
    return "این کد تخفیف منقضی شده است.";
  if (price !== undefined && price !== null) {
    if (row.min_purchase && price < row.min_purchase)
      return `حداقل مبلغ خرید برای این کد ${Number(row.min_purchase).toLocaleString("fa-IR")} تومان است.`;
    if (row.max_purchase && price > row.max_purchase)
      return `این کد فقط برای خریدهای تا سقف ${Number(row.max_purchase).toLocaleString("fa-IR")} تومان معتبر است.`;
  }
  return null;
}

export function getDiscountByCode(code) {
  return db.prepare("SELECT * FROM discount_codes WHERE code = ?").get(normalizeCode(code));
}

/* Validate a code against a cart total without consuming it.
   Returns { ok, amount, reason, code } — amount is the discount
   that would be applied. */
export function validateDiscount(code, price) {
  const row = getDiscountByCode(code);
  const reason = discountInvalidReason(row, price);
  if (reason) return { ok: false, amount: 0, reason, code: normalizeCode(code) };
  return {
    ok: true,
    amount: computeDiscountAmount(row, price),
    reason: null,
    code: row.code
  };
}

/* Validate AND consume one use atomically. Returns the same shape as
   validateDiscount; ok:false means the code must not be applied. */
export function redeemDiscount(code, price) {
  const normalized = normalizeCode(code);
  const row = getDiscountByCode(code);
  const reason = discountInvalidReason(row, price);
  if (reason) return { ok: false, amount: 0, reason, code: normalized };

  const cur = db
    .prepare(
      `UPDATE discount_codes
         SET used_count = used_count + 1
       WHERE id = ? AND is_active = 1
         AND (max_uses = 0 OR used_count < max_uses)`
    )
    .run(row.id);

  if (cur.changes !== 1)
    return {
      ok: false,
      amount: 0,
      reason: "سقف استفاده از این کد تخفیف تمام شده است.",
      code: normalized
    };

  return { ok: true, amount: computeDiscountAmount(row, price), reason: null, code: row.code };
}

/* Release a use when an order is cancelled/deleted, so a one-shot
   code can be used again. */
export function releaseDiscount(code) {
  const normalized = normalizeCode(code);
  db.prepare(
    "UPDATE discount_codes SET used_count = MAX(used_count - 1, 0) WHERE code = ?"
  ).run(normalized);
}

export function listDiscountCodes() {
  return db
    .prepare("SELECT * FROM discount_codes ORDER BY id DESC")
    .all()
    .map((r) => ({
      id: r.id,
      code: r.code,
      percent: r.percent || null,
      fixedAmount: r.fixed_amount || null,
      maxDiscountAmount: r.max_discount_amount || null,
      maxUses: r.max_uses || 0,
      usedCount: r.used_count || 0,
      expiresAt: r.expires_at || null,
      minPurchase: r.min_purchase || null,
      maxPurchase: r.max_purchase || null,
      isActive: !!r.is_active,
      note: r.note || "",
      createdAt: r.created_at
    }));
}

export function createDiscountCode(fields) {
  const code = normalizeCode(fields.code);
  if (!code) throw new Error("کد تخفیف الزامی است");
  if (getDiscountByCode(code)) throw new Error("این کد تخفیف قبلاً وجود دارد");

  const percent = fields.percent ? Math.min(100, Math.max(1, parseInt(fields.percent, 10) || 0)) : null;
  const fixed = fields.fixedAmount ? Math.max(1, parseInt(fields.fixedAmount, 10) || 0) : null;
  if (!percent && !fixed) throw new Error("درصد یا مبلغ ثابت تخفیف را وارد کنید");

  db.prepare(
    `INSERT INTO discount_codes
       (code, percent, fixed_amount, max_discount_amount, max_uses, expires_at,
        min_purchase, max_purchase, is_active, note)
     VALUES (?,?,?,?,?,?,?,?,1,?)`
  ).run(
    code,
    percent,
    fixed,
    fields.maxDiscountAmount ? parseInt(fields.maxDiscountAmount, 10) || null : null,
    Math.max(0, parseInt(fields.maxUses, 10) || 0),
    fields.expiresAt || null,
    fields.minPurchase ? parseInt(fields.minPurchase, 10) || null : null,
    fields.maxPurchase ? parseInt(fields.maxPurchase, 10) || null : null,
    fields.note || null
  );
  return getDiscountByCode(code);
}

export function updateDiscountCode(id, fields) {
  const row = db.prepare("SELECT * FROM discount_codes WHERE id = ?").get(Number(id));
  if (!row) throw new Error("کد تخفیف پیدا نشد");

  const percent = fields.percent ? Math.min(100, Math.max(1, parseInt(fields.percent, 10) || 0)) : null;
  const fixed = fields.fixedAmount ? Math.max(1, parseInt(fields.fixedAmount, 10) || 0) : null;
  if (!percent && !fixed) throw new Error("درصد یا مبلغ ثابت تخفیف را وارد کنید");

  db.prepare(
    `UPDATE discount_codes SET
       percent = ?, fixed_amount = ?, max_discount_amount = ?, max_uses = ?,
       expires_at = ?, min_purchase = ?, max_purchase = ?, note = ?
     WHERE id = ?`
  ).run(
    percent,
    fixed,
    fields.maxDiscountAmount ? parseInt(fields.maxDiscountAmount, 10) || null : null,
    Math.max(0, parseInt(fields.maxUses, 10) || 0),
    fields.expiresAt || null,
    fields.minPurchase ? parseInt(fields.minPurchase, 10) || null : null,
    fields.maxPurchase ? parseInt(fields.maxPurchase, 10) || null : null,
    fields.note || null,
    Number(id)
  );
  return getDiscountByCode(row.code);
}

export function toggleDiscountCode(id) {
  const row = db.prepare("SELECT * FROM discount_codes WHERE id = ?").get(Number(id));
  if (!row) throw new Error("کد تخفیف پیدا نشد");
  db.prepare("UPDATE discount_codes SET is_active = ? WHERE id = ?").run(
    row.is_active ? 0 : 1,
    Number(id)
  );
  return getDiscountByCode(row.code);
}

export function deleteDiscountCode(id) {
  db.prepare("DELETE FROM discount_codes WHERE id = ?").run(Number(id));
}
