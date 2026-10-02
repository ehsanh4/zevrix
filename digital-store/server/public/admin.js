/* ============================================================
   ZEVRIX — Admin Panel logic (Persian / RTL)
   ============================================================ */
const TOKEN_KEY = "ds-admin-token";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- API helper ---------- */
async function api(path, { method = "GET", body, isForm = false } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  let data = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) throw new Error(data.error || "خطای سرور");
  return data;
}

/* ---------- Utils ---------- */
const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function toast(msg, isErr = false) {
  const t = document.createElement("div");
  t.className = "toast" + (isErr ? " err" : "");
  t.textContent = msg;
  $("#toastWrap").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 3200);
  setTimeout(() => t.remove(), 3600);
}

/* ---------- State ---------- */
let CATEGORIES = [];
let PRODUCTS = [];
let ORDERS = [];
let currentView = "dashboard";
let productSearch = "";
let editingId = null;

const VIEW_TITLES = {
  dashboard: "داشبورد",
  products: "مدیریت محصولات",
  orders: "سفارش‌ها",
  gateways: "درگاه پرداخت",
  settings: "تنظیمات"
};

/* ============================================================
   AUTH
   ============================================================ */
function showPanel() {
  $("#loginScreen").classList.add("hidden");
  $("#panel").classList.remove("hidden");
  init();
}

function showLogin() {
  localStorage.removeItem(TOKEN_KEY);
  $("#panel").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
  $("#liPass").value = "";
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("#loginError");
  errEl.textContent = "";
  const btn = $("#loginForm button[type=submit]");
  btn.textContent = "در حال ورود…";
  btn.disabled = true;
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: {
        username: $("#liUser").value.trim(),
        password: $("#liPass").value
      }
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    $("#adminChip").textContent = "👤 " + (data.admin.name || data.admin.username);
    btn.textContent = "ورود به پنل";
    btn.disabled = false;
    showPanel();
    toast("خوش آمدید 👋");
  } catch (err) {
    errEl.textContent = err.message;
    btn.textContent = "ورود به پنل";
    btn.disabled = false;
  }
});

$("#logoutBtn").addEventListener("click", () => {
  showLogin();
  toast("از پنل خارج شدید");
});

$("#viewSiteBtn").addEventListener("click", () => window.open("/", "_blank"));

/* ---------- Sidebar (mobile) ---------- */
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$$(".side-link").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".side-link").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    go(btn.dataset.view);
    $("#sidebar").classList.remove("open");
  })
);

/* ============================================================
   ROUTER
   ============================================================ */
async function go(view) {
  currentView = view;
  $("#pageTitle").textContent = VIEW_TITLES[view] || view;
  const content = $("#content");
  content.innerHTML = `<div class="empty"><div class="e-ico">⏳</div><p>در حال بارگذاری…</p></div>`;
  try {
    if (view === "dashboard") await renderDashboard();
    if (view === "products") await renderProducts();
    if (view === "orders") await renderOrders();
    if (view === "gateways") await renderGateways();
    if (view === "settings") await renderSettings();
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="e-ico">⚠️</div><p>${esc(err.message)}</p></div>`;
  }
}

async function init() {
  try {
    const me = await api("/api/admin/me");
    $("#adminChip").textContent = "👤 " + (me.admin.name || me.admin.username);
  } catch { /* chip already set */ }
  CATEGORIES = await api("/api/categories");
  await refreshBadge();
  go("dashboard");
}

async function refreshBadge() {
  try {
    const st = await api("/api/admin/stats");
    const badge = $("#ordersBadge");
    if (st.pending > 0) {
      badge.style.display = "grid";
      badge.textContent = faNum(st.pending);
    } else badge.style.display = "none";
  } catch { /* ignore */ }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard() {
  const s = await api("/api/admin/stats");
  const catName = (id) => {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? c.name.fa : id;
  };
  const maxCat = Math.max(1, ...s.byCat.map((c) => c.c));

  $("#content").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--sc:#6d5dfc">
        <div class="stat-ico">📦</div>
        <div class="stat-value">${faNum(s.products)}</div>
        <div class="stat-label">کل محصولات</div>
      </div>
      <div class="stat-card" style="--sc:#00d4a0">
        <div class="stat-ico">✅</div>
        <div class="stat-value">${faNum(s.active)}</div>
        <div class="stat-label">محصولات فعال</div>
      </div>
      <div class="stat-card" style="--sc:#00d4ff">
        <div class="stat-ico">🧾</div>
        <div class="stat-value">${faNum(s.orders)}</div>
        <div class="stat-label">کل سفارش‌ها</div>
      </div>
      <div class="stat-card" style="--sc:#ffa726">
        <div class="stat-ico">⏳</div>
        <div class="stat-value">${faNum(s.pending)}</div>
        <div class="stat-label">سفارش‌های در انتظار</div>
      </div>
      <div class="stat-card" style="--sc:#ff5c7a">
        <div class="stat-ico">💰</div>
        <div class="stat-value">${faNum(s.revenue)} <small style="font-size:13px;color:var(--muted)">تومان</small></div>
        <div class="stat-label">درآمد کل</div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-head"><h3>📊 محصولات بر اساس دسته</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" data-goto="products">مدیریت محصولات ←</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:12px">
        ${s.byCat.length ? s.byCat.map((c) => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
              <b>${esc(catName(c.cat))}</b><span style="color:var(--muted)">${faNum(c.c)} محصول</span>
            </div>
            <div style="height:9px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden">
              <div style="height:100%;width:${(c.c / maxCat) * 100}%;border-radius:99px;background:var(--grad)"></div>
            </div>
          </div>`).join("")
        : `<div class="empty"><div class="e-ico">📭</div><p>هنوز محصولی ثبت نشده است</p></div>`}
      </div>
    </div>

    <div class="table-card" style="margin-top:16px">
      <div class="table-head"><h3>🚀 میانبرها</h3></div>
      <div style="padding:18px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-goto="products">➕ افزودن محصول</button>
        <button class="btn btn-ghost btn-sm" data-goto="orders">🧾 مشاهده سفارش‌ها</button>
        <button class="btn btn-ghost btn-sm" data-goto="settings">⚙️ تنظیمات فروشگاه</button>
      </div>
    </div>`;

  $$("[data-goto]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.goto;
    $$(".side-link").forEach((x) => x.classList.toggle("active", x.dataset.view === v));
    go(v);
  }));
}

/* ============================================================
   PRODUCTS
   ============================================================ */
async function loadProducts() {
  PRODUCTS = await api("/api/admin/products");
}

/* License-key stock per product, keyed by product id */
let KEY_STOCK = {};

async function loadKeyStock() {
  try {
    KEY_STOCK = await api("/api/admin/products/keys/summary");
  } catch { KEY_STOCK = {}; }
}

async function renderProducts() {
  await loadProducts();
  await loadKeyStock();
  const q = productSearch.trim().toLowerCase();
  const list = q
    ? PRODUCTS.filter((p) =>
        (p.name.fa + " " + p.name.en + " " + p.cat).toLowerCase().includes(q)
      )
    : PRODUCTS;

  $("#content").innerHTML = `
    <div class="table-card">
      <div class="table-head">
        <h3>📦 محصولات (${faNum(list.length)})</h3>
        <div class="spacer"></div>
        <input class="search-box" id="prodSearch" placeholder="🔍 جستجوی محصول…" value="${esc(productSearch)}" />
        <button class="btn btn-primary btn-sm" id="addProdBtn">➕ محصول جدید</button>
      </div>
      <div class="table-scroll">
        ${list.length ? `<table>
          <thead>
            <tr>
              <th>محصول</th><th>دسته</th><th>قیمت</th><th>فروش</th>
              <th>امتیاز</th><th>موجودی لایسنس</th><th>وضعیت</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${list.map((p) => {
              const cat = CATEGORIES.find((c) => c.id === p.cat);
              return `<tr>
                <td>
                  <div class="p-name">
                    <div class="p-thumb">${p.image
                      ? `<img src="${esc(p.image)}" alt="">`
                      : esc(p.icon)}</div>
                    <div>
                      <div class="p-title">${esc(p.name.fa)}</div>
                      <div class="p-sub">${esc(p.name.en)}</div>
                    </div>
                  </div>
                </td>
                <td><span class="pill info">${esc(cat ? cat.name.fa : p.cat)}</span></td>
                <td class="num">
                  <b>${faNum(p.price)}</b> تومان
                  ${p.oldPrice ? `<div class="p-sub"><s>${faNum(p.oldPrice)}</s></div>` : ""}
                </td>
                <td class="num">${faNum(p.sold)}</td>
                <td class="num">⭐ ${Number(p.rating).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
                  <div class="p-sub">${faNum(p.reviews)} نظر</div></td>
                <td class="num">
                  <button class="stock-btn" data-keys="${p.id}" title="مدیریت لایسنس‌ها">
                    <b>${faNum((KEY_STOCK[p.id] || {}).available || 0)}</b>
                    <div class="p-sub">آماده تحویل</div>
                  </button>
                </td>
                <td>
                  <span class="pill ${p.active ? "ok" : "muted"}">${p.active ? "فعال" : "غیرفعال"}</span>
                  ${p.featured ? `<span class="pill warn">ویژه</span>` : ""}
                </td>
                <td>
                  <div class="row-actions">
                    <button class="icon-btn" data-edit="${p.id}" title="ویرایش">✏️</button>
                    <button class="icon-btn danger" data-del="${p.id}" title="حذف">🗑</button>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`
        : `<div class="empty"><div class="e-ico">📭</div>
             <p>${q ? "نتیجه‌ای یافت نشد" : "هنوز محصولی اضافه نکرده‌اید"}</p></div>`}
      </div>
    </div>`;

  const search = $("#prodSearch");
  search.addEventListener("input", () => {
    productSearch = search.value;
    const pos = search.selectionStart;
    renderProducts().then(() => {
      const s2 = $("#prodSearch");
      s2.focus();
      s2.setSelectionRange(pos, pos);
    });
  });

  $("#addProdBtn").addEventListener("click", () => openProductModal(null));
  $$("[data-keys]").forEach((b) =>
    b.addEventListener("click", () => openKeysModal(Number(b.dataset.keys)))
  );
  $$("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PRODUCTS.find((x) => x.id === Number(b.dataset.edit));
      openProductModal(p);
    })
  );
  $$("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const p = PRODUCTS.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`حذف «${p.name.fa}»؟ این عمل قابل بازگشت نیست.`)) return;
      try {
        await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
        toast("محصول حذف شد");
        renderProducts();
        refreshBadge();
      } catch (err) { toast(err.message, true); }
    })
  );
}

/* ============================================================
   PRODUCT MODAL (add / edit)
   ============================================================ */
function openProductModal(p) {
  editingId = p ? p.id : null;
  const isNew = !p;
  const v = p || {
    name: { fa: "", en: "" }, cat: CATEGORIES[0]?.id || "software",
    icon: "📦", image: null, price: "", oldPrice: "",
    rating: 5, reviews: 0, sold: 0, badge: { fa: "", en: "" },
    desc: { fa: "", en: "" }, specs: { fa: [], en: [] },
    featured: false, active: true
  };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${isNew ? "➕ محصول جدید" : "✏️ ویرایش محصول"}</h3>
        <button class="icon-btn" id="mClose">✕</button>
      </div>
      <form id="prodForm">
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full">
              <label>تصویر محصول</label>
              <div class="img-picker">
                <div class="img-preview" id="imgPreview">${
                  v.image ? `<img src="${esc(v.image)}" alt="">` : esc(v.icon)
                }</div>
                <input type="file" id="imgFile" accept="image/*" style="display:none" />
                <button type="button" class="btn btn-ghost btn-sm" id="pickImg">📷 انتخاب تصویر</button>
                <button type="button" class="btn btn-ghost btn-sm danger" id="clearImg">حذف</button>
              </div>
              <div class="form-hint">حداکثر ۴ مگابایت — PNG / JPG / WebP</div>
            </div>

            <div class="field">
              <label>نام (فارسی) *</label>
              <input id="f_fa" value="${esc(v.name.fa)}" required placeholder="مثلاً: لایسنس ویندوز ۱۱" />
            </div>
            <div class="field">
              <label>نام (انگلیسی) *</label>
              <input id="f_en" value="${esc(v.name.en)}" required dir="ltr" placeholder="Windows 11 License" />
            </div>

            <div class="field">
              <label>دسته‌بندی *</label>
              <select id="f_cat">
                ${CATEGORIES.map((c) => `
                  <option value="${esc(c.id)}" ${c.id === v.cat ? "selected" : ""}>
                    ${esc(c.name.fa)} — ${esc(c.name.en)}
                  </option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>آیکون (اموجی)</label>
              <input id="f_icon" value="${esc(v.icon)}" placeholder="📦" maxlength="4" />
            </div>

            <div class="field">
              <label>قیمت (تومان) *</label>
              <input id="f_price" type="number" min="0" value="${v.price}" required />
            </div>
            <div class="field">
              <label>قیمت قبل از تخفیف</label>
              <input id="f_old" type="number" min="0" value="${v.oldPrice || ""}" placeholder="اختیاری" />
            </div>

            <div class="field">
              <label>امتیاز (۰ تا ۵)</label>
              <input id="f_rating" type="number" min="0" max="5" step="0.1" value="${v.rating}" />
            </div>
            <div class="field">
              <label>تعداد نظرات</label>
              <input id="f_reviews" type="number" min="0" value="${v.reviews}" />
            </div>

            <div class="field">
              <label>تعداد فروش</label>
              <input id="f_sold" type="number" min="0" value="${v.sold}" />
            </div>
            <div class="field">
              <label>برچسب (فارسی)</label>
              <input id="f_bfa" value="${esc(v.badge?.fa || "")}" placeholder="مثلاً: پرفروش" />
            </div>

            <div class="field">
              <label>برچسب (انگلیسی)</label>
              <input id="f_ben" value="${esc(v.badge?.en || "")}" dir="ltr" placeholder="Best Seller" />
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <div style="display:flex;gap:14px;align-items:center;height:42px">
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--text)">
                  <input type="checkbox" id="f_feat" ${v.featured ? "checked" : ""} /> محصول ویژه
                </label>
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--text)">
                  <input type="checkbox" id="f_act" ${v.active !== false ? "checked" : ""} /> فعال
                </label>
              </div>
            </div>

            <div class="field full">
              <label>توضیحات (فارسی)</label>
              <textarea id="f_dfa" placeholder="توضیحات محصول…">${esc(v.desc.fa)}</textarea>
            </div>
            <div class="field full">
              <label>توضیحات (انگلیسی)</label>
              <textarea id="f_den" dir="ltr" placeholder="Product description…">${esc(v.desc.en)}</textarea>
            </div>

            <div class="field full">
              <label>ویژگی‌ها (فارسی) — هر خط یک ویژگی</label>
              <textarea id="f_sfa" placeholder="لایسنس اورجینال&#10;تحویل آنی">${esc((v.specs.fa || []).join("\n"))}</textarea>
            </div>
            <div class="field full">
              <label>ویژگی‌ها (انگلیسی) — هر خط یک ویژگی</label>
              <textarea id="f_sen" dir="ltr" placeholder="Original license&#10;Instant delivery">${esc((v.specs.en || []).join("\n"))}</textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="mCancel">انصراف</button>
          <button type="submit" class="btn btn-primary">${isNew ? "افزودن محصول" : "ذخیره تغییرات"}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";
  const close = () => {
    backdrop.remove();
    document.body.style.overflow = "";
  };
  $("#mClose").addEventListener("click", close);
  $("#mCancel").addEventListener("click", close);
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });

  /* image upload */
  let imageUrl = v.image || null;
  const updatePreview = (url, icon) => {
    imageUrl = url;
    $("#imgPreview").innerHTML = url ? `<img src="${esc(url)}" alt="">` : esc(icon || "📦");
  };
  $("#pickImg").addEventListener("click", () => $("#imgFile").click());
  $("#clearImg").addEventListener("click", () => updatePreview(null, $("#f_icon").value));
  $("#imgFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast("در حال آپلود تصویر…");
      const fd = new FormData();
      fd.append("image", file);
      const data = await api("/api/admin/upload", { method: "POST", body: fd, isForm: true });
      updatePreview(data.url);
      toast("تصویر آپلود شد ✓");
    } catch (err) { toast(err.message, true); }
  });

  /* submit */
  $("#prodForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      fa: $("#f_fa").value.trim(),
      en: $("#f_en").value.trim(),
      cat: $("#f_cat").value,
      icon: $("#f_icon").value.trim() || "📦",
      price: Number($("#f_price").value) || 0,
      old_price: $("#f_old").value ? Number($("#f_old").value) : null,
      rating: Number($("#f_rating").value) || 5,
      reviews: Number($("#f_reviews").value) || 0,
      sold: Number($("#f_sold").value) || 0,
      badge_fa: $("#f_bfa").value.trim() || null,
      badge_en: $("#f_ben").value.trim() || null,
      desc_fa: $("#f_dfa").value,
      desc_en: $("#f_den").value,
      specs_fa: $("#f_sfa").value.split("\n").map((s) => s.trim()).filter(Boolean),
      specs_en: $("#f_sen").value.split("\n").map((s) => s.trim()).filter(Boolean),
      image: imageUrl,
      featured: $("#f_feat").checked,
      active: $("#f_act").checked
    };

    const btn = $("#prodForm button[type=submit]");
    btn.textContent = "در حال ذخیره…";
    btn.disabled = true;
    try {
      if (isNew) {
        await api("/api/admin/products", { method: "POST", body: payload });
        toast("محصول اضافه شد ✓");
      } else {
        await api(`/api/admin/products/${editingId}`, { method: "PUT", body: payload });
        toast("تغییرات ذخیره شد ✓");
      }
      close();
      renderProducts();
      refreshBadge();
    } catch (err) {
      toast(err.message, true);
      btn.textContent = isNew ? "افزودن محصول" : "ذخیره تغییرات";
      btn.disabled = false;
    }
  });

  $("#f_fa").focus();
}

/* ============================================================
   LICENSE KEYS MODAL (per product)
   ============================================================ */
async function openKeysModal(productId) {
  const p = PRODUCTS.find((x) => x.id === productId);
  if (!p) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3>🔑 لایسنس‌های «${esc(p.name.fa)}»</h3>
        <button class="icon-btn" id="kClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="keys-add">
          <label>افزودن لایسنس جدید (هر خط یک لایسنس)</label>
          <textarea id="kInput" rows="5" placeholder="مثلاً&#10;XXXX-XXXX-XXXX-XXXX&#10;YYYY-YYYY-YYYY-YYYY" dir="ltr"></textarea>
          <button class="btn btn-primary btn-sm" id="kAdd">➕ افزودن لایسنس</button>
        </div>
        <div class="keys-stats" id="kStats"></div>
        <div class="table-scroll">
          <table id="kTable">
            <thead><tr><th>لایسنس</th><th>وضعیت</th><th>سفارش</th><th></th></tr></thead>
            <tbody id="kBody"><tr><td colspan="4">در حال بارگذاری…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = "";
  };
  $("#kClose").addEventListener("click", close);
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });

  async function refresh() {
    const [keys, stock] = await Promise.all([
      api(`/api/admin/products/${productId}/keys`),
      api("/api/admin/products/keys/summary").catch(() => ({})),
    ]);
    KEY_STOCK = stock;
    const st = (stock[productId] || { available: 0, sold: 0 });
    $("#kStats").innerHTML = `
      <span class="pill ok">آماده تحویل: ${faNum(st.available)}</span>
      <span class="pill muted">فروخته شده: ${faNum(st.sold)}</span>`;

    if (!keys.length) {
      $("#kBody").innerHTML = `<tr><td colspan="4" class="empty-cell">
        <div class="empty"><div class="e-ico">🔑</div>
        <p>هنوز لایسنسی ثبت نشده. با افزودن لایسنس، تحویل خودکار فعال می‌شود.</p></div>
      </td></tr>`;
      return;
    }
    $("#kBody").innerHTML = keys.map((k) => `
      <tr>
        <td class="mono" dir="ltr">${esc(k.key_text)}</td>
        <td><span class="pill ${k.status === "available" ? "ok" : "warn"}">
          ${k.status === "available" ? "آماده" : "فروخته شده"}</span></td>
        <td>${k.order_ref ? `<span class="mono">${esc(k.order_ref)}</span>` : "—"}</td>
        <td>${k.status === "available"
          ? `<button class="icon-btn danger" data-kdel="${k.id}" title="حذف">🗑</button>`
          : ""}</td>
      </tr>`).join("");

    $$("[data-kdel]", $("#kBody")).forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/admin/products/${productId}/keys/${b.dataset.kdel}`, { method: "DELETE" });
          toast("لایسنس حذف شد");
          refresh();
          loadKeyStock().then(() => renderProducts());
        } catch (err) { toast(err.message, true); }
      })
    );
  }

  $("#kAdd").addEventListener("click", async () => {
    const raw = $("#kInput").value.trim();
    if (!raw) return toast("ابتدا لایسنس‌ها را وارد کنید", true);
    const btn = $("#kAdd");
    btn.textContent = "در حال افزودن…";
    btn.disabled = true;
    try {
      const r = await api(`/api/admin/products/${productId}/keys`, {
        method: "POST",
        body: { keys: raw },
      });
      toast(`${faNum(r.added)} لایسنس اضافه شد${r.duplicates ? ` (${faNum(r.duplicates)} تکراری نادیده گرفته شد)` : ""} ✓`);
      $("#kInput").value = "";
      refresh();
      renderProducts();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.textContent = "➕ افزودن لایسنس";
      btn.disabled = false;
    }
  });

  refresh();
}

/* ============================================================
   ORDERS
   ============================================================ */
const ORDER_STATUS = {
  pending: { label: "در انتظار", pill: "warn" },
  paid: { label: "پرداخت شده", pill: "info" },
  delivered: { label: "تحویل داده شده", pill: "ok" },
  cancelled: { label: "لغو شده", pill: "danger" }
};

async function renderOrders() {
  ORDERS = await api("/api/admin/orders");

  $("#content").innerHTML = `
    <div class="table-card">
      <div class="table-head">
        <h3>🧾 سفارش‌ها (${faNum(ORDERS.length)})</h3>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" id="refreshOrders">↻ بروزرسانی</button>
      </div>
      <div class="table-scroll">
        ${ORDERS.length ? `<table>
          <thead>
            <tr>
              <th>کد سفارش</th><th>مشتری</th><th>آیتم‌ها</th><th>مبلغ</th>
              <th>تاریخ</th><th>پرداخت</th><th>وضعیت</th><th>لایسنس</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${ORDERS.map((o) => {
              const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
              const items = Array.isArray(o.items) ? o.items : [];
              const methodLabel = o.payMethod === "zarinpal" ? "زرین‌پال" : o.payMethod === "card" ? "کارت به کارت" : "—";
              return `<tr>
                <td><b style="font-variant-numeric:tabular-nums" dir="ltr">${esc(o.ref)}</b></td>
                <td>
                  <div class="p-title">${esc(o.customer)}</div>
                  <div class="p-sub" dir="ltr">${esc(o.email)}</div>
                  ${o.phone ? `<div class="p-sub" dir="ltr">📞 ${esc(o.phone)}</div>` : ""}
                </td>
                <td>
                  ${items.length
                    ? items.map((it) => `<div style="margin-bottom:3px">• ${esc(it.name || it.fa || "محصول")} <span style="color:var(--muted)">×${faNum(it.qty || 1)}</span></div>`).join("")
                    : '<span style="color:var(--muted)">—</span>'}
                </td>
                <td class="num"><b>${faNum(o.total)}</b> تومان</td>
                <td class="num" style="white-space:nowrap;color:var(--muted)">${esc(o.created_at)}</td>
                <td style="white-space:nowrap">
                  <div style="margin-bottom:4px">${methodLabel}</div>
                  ${o.payStatus === "paid"
                    ? `<span class="pill ok">پرداخت شده</span>`
                    : o.payStatus === "failed"
                    ? `<span class="pill danger">ناموفق</span>`
                    : o.payStatus === "pending"
                    ? `<span class="pill warn">در انتظار</span>`
                    : `<span class="pill muted">—</span>`}
                  ${o.refId ? `<div class="p-sub" dir="ltr">کد: ${esc(o.refId)}</div>` : ""}
                  ${o.receiptUrl && o.receiptUrl.startsWith("/")
                    ? `<div style="margin-top:4px"><a href="${esc(o.receiptUrl)}" target="_blank" class="btn btn-ghost btn-sm">🧾 رسید</a></div>`
                    : o.payMethod === "card"
                    ? `<div style="margin-top:4px"><span class="pill info">📨 ارسال شده به تلگرام</span></div>`
                    : ""}
                </td>
                <td>
                  <select data-status="${o.id}" class="search-box" style="width:auto">
                    ${Object.entries(ORDER_STATUS).map(([k, s]) => `
                      <option value="${k}" ${k === o.status ? "selected" : ""}>${s.label}</option>`).join("")}
                  </select>
                </td>
                <td style="white-space:nowrap">
                  ${o.delivered_at
                    ? `<span class="pill ok">✅ تحویل شد</span>
                       <div class="p-sub">${esc(o.delivered_at)}</div>`
                    : o.status === "paid"
                    ? `<button class="btn btn-primary btn-sm" data-deliver="${o.id}">🎁 تحویل لایسنس</button>`
                    : `<span class="pill muted">—</span>`}
                </td>
                <td>
                  <div class="row-actions">
                    ${o.payMethod === "card" && o.payStatus !== "paid"
                      ? `<button class="icon-btn" data-verify="${o.id}" title="تأیید دستی پرداخت کارتی">✅</button>`
                      : ""}
                    <button class="icon-btn danger" data-odel="${o.id}" title="حذف">🗑</button>
                  </div>
                  ${o.receiptUrl && o.receiptUrl.startsWith("/")
                    ? `<div style="margin-top:6px"><img src="${esc(o.receiptUrl)}" alt="رسید" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--line)" /></div>`
                    : ""}
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`
        : `<div class="empty"><div class="e-ico">🧾</div><p>هنوز سفارشی ثبت نشده است</p></div>`}
      </div>
    </div>`;

  $("#refreshOrders").addEventListener("click", () => renderOrders());
  $$("[data-status]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      try {
        await api(`/api/admin/orders/${sel.dataset.status}/status`, {
          method: "PUT",
          body: { status: sel.value }
        });
        toast("وضعیت سفارش بروزرسانی شد ✓");
        refreshBadge();
      } catch (err) { toast(err.message, true); renderOrders(); }
    })
  );
  $$("[data-odel]").forEach((b) =>
    b.addEventListener("click", async () => {
      const o = ORDERS.find((x) => x.id === Number(b.dataset.odel));
      if (!confirm(`سفارش «${o.ref}» حذف شود؟`)) return;
      try {
        await api(`/api/admin/orders/${o.id}`, { method: "DELETE" });
        toast("سفارش حذف شد");
        renderOrders();
        refreshBadge();
      } catch (err) { toast(err.message, true); }
    })
  );
  $$("[data-verify]").forEach((b) =>
    b.addEventListener("click", async () => {
      const o = ORDERS.find((x) => x.id === Number(b.dataset.verify));
      if (!confirm(`پرداخت کارتی سفارش «${o.ref}» تأیید و وضعیت به «پرداخت شده» تغییر کند؟`)) return;
      try {
        const r = await api(`/api/admin/orders/${o.id}/verify`, { method: "PUT" });
        const d = r.delivery || {};
        if (d.ok) {
          const n = (d.delivered || []).reduce((s, x) => s + x.keys.length, 0);
          toast(`پرداخت تأیید شد — ${faNum(n)} لایسنس تحویل شد ✓`);
          if (d.missing && d.missing.length)
            toast(`⚠️ موجودی ناکافی: ${d.missing.map((m) => m.name).join("، ")}`, true);
        } else {
          toast("پرداخت تأیید شد، اما لایسنسی در دسترس نیست", true);
        }
        renderOrders();
        refreshBadge();
      } catch (err) { toast(err.message, true); }
    })
  );
  $$("[data-deliver]").forEach((b) =>
    b.addEventListener("click", async () => {
      const o = ORDERS.find((x) => x.id === Number(b.dataset.deliver));
      try {
        const r = await api(`/api/admin/orders/${o.id}/deliver`, { method: "POST" });
        if (r.ok) {
          const n = (r.delivered || []).reduce((s, x) => s + x.keys.length, 0);
          toast(`${faNum(n)} لایسنس تحویل مشتری شد ✓`);
          if (r.missing && r.missing.length)
            toast(`⚠️ موجودی ناکافی: ${r.missing.map((m) => m.name).join("، ")}`, true);
        } else {
          toast(r.error === "no keys available" ? "لایسنسی در دسترس نیست" : (r.error || "خطا در تحویل"), true);
        }
        renderOrders();
      } catch (err) { toast(err.message, true); }
    })
  );
}

/* ============================================================
   PAYMENT GATEWAYS
   ============================================================ */
const PG_LABELS = {
  zarinpal: "زرین‌پال",
  card: "کارت به کارت"
};

async function renderGateways() {
  const cfg = await api("/api/admin/payment/gateways");

  const on = (k) => (cfg[k] === "1" || cfg[k] === true);

  $("#content").innerHTML = `
    <div class="settings-card" style="margin-bottom:16px">
      <div class="table-head" style="padding:0 0 14px;border-bottom:1px solid var(--line)">
        <h3>💳 درگاه پرداخت زرین‌پال</h3>
        <div class="spacer"></div>
        <span class="pill ${on("pg_zarinpal_enabled") ? "ok" : "muted"}">
          ${on("pg_zarinpal_enabled") ? "فعال" : "غیرفعال"}
        </span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>فعال‌سازی درگاه زرین‌پال</b><span>پرداخت آنلاین از طریق درگاه زرین‌پال</span></div>
        <label class="switch">
          <input type="checkbox" id="gwZarinpalEnabled" ${on("pg_zarinpal_enabled") ? "checked" : ""} />
          <span class="slider"></span>
        </label>
      </div>
      <div class="set-item">
        <div class="s-label"><b>کد مرچنت (Merchant ID)</b><span>کد اختصاصی درگاه شما در زرین‌پال — از پنل زرین‌پال قابل دریافت است</span></div>
        <input class="search-box" id="gwMerchant" dir="ltr" placeholder="00000000-0000-0000-0000-000000000000" value="${esc(cfg.pg_zarinpal_merchant || "")}" style="width:100%;max-width:340px" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>حالت تست (Sandbox)</b><span>برای آزمایش درگاه بدون پرداخت واقعی — روی سایت اصلی غیرفعال باشد</span></div>
        <label class="switch">
          <input type="checkbox" id="gwSandbox" ${on("pg_zarinpal_sandbox") ? "checked" : ""} />
          <span class="slider"></span>
        </label>
      </div>
      <div class="set-item">
        <div class="s-label"><b>نحوه کار</b><span>۱) مشتری روی «پرداخت آنلاین» کلیک می‌کند → ۲) به درگاه زرین‌پال هدایت می‌شود → ۳) پس از پرداخت موفق، سفارش خودکار «پرداخت شده» می‌شود.</span></div>
        <span class="pill info">اتوماتیک</span>
      </div>
    </div>

    <div class="settings-card" style="margin-bottom:16px">
      <div class="table-head" style="padding:0 0 14px;border-bottom:1px solid var(--line)">
        <h3>🏦 پرداخت کارت به کارت</h3>
        <div class="spacer"></div>
        <span class="pill ${on("pg_card_enabled") ? "ok" : "muted"}">
          ${on("pg_card_enabled") ? "فعال" : "غیرفعال"}
        </span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>فعال‌سازی کارت به کارت</b><span>مشتری مبلغ را به کارت زیر واریز کرده و رسید را آپلود می‌کند</span></div>
        <label class="switch">
          <input type="checkbox" id="gwCardEnabled" ${on("pg_card_enabled") ? "checked" : ""} />
          <span class="slider"></span>
        </label>
      </div>
      <div class="set-item">
        <div class="card-grid">
          <div class="field">
            <label>شماره کارت</label>
            <input class="search-box" id="gwCardNumber" dir="ltr" inputmode="numeric" placeholder="۱۶ رقم" value="${esc(cfg.pg_card_number || "")}" style="width:100%" />
          </div>
          <div class="field">
            <label>نام صاحب کارت</label>
            <input class="search-box" id="gwCardHolder" placeholder="مثلاً: علی رضایی" value="${esc(cfg.pg_card_holder || "")}" style="width:100%" />
          </div>
          <div class="field">
            <label>نام بانک</label>
            <input class="search-box" id="gwCardBank" placeholder="مثلاً: بانک ملت" value="${esc(cfg.pg_card_bank || "")}" style="width:100%" />
          </div>
          <div class="field">
            <label>شماره شبا</label>
            <input class="search-box" id="gwCardSheba" dir="ltr" placeholder="IR..." value="${esc(cfg.pg_card_sheba || "")}" style="width:100%" />
          </div>
        </div>
      </div>
      <div class="set-item">
        <div class="s-label"><b>توضیحات اضافی برای مشتری</b><span>مثلاً: «لطفاً پس از واریز، رسید را تا ۲۴ ساعت آپلود کنید»</span></div>
        <input class="search-box" id="gwCardDesc" placeholder="توضیحات…" value="${esc(cfg.pg_card_desc || "")}" style="width:100%" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>نحوه کار</b><span>مشتری شماره کارت را می‌بیند → واریز می‌کند → عکس/PDF رسید را آپلود می‌کند → شما در بخش «سفارش‌ها» رسید را بررسی کرده و پرداخت را تأیید می‌کنید.</span></div>
        <span class="pill warn">تأیید دستی</span>
      </div>
    </div>

    <div class="settings-card" style="margin-bottom:16px">
      <div class="table-head" style="padding:0 0 14px;border-bottom:1px solid var(--line)">
        <h3>📨 نوتیفیکیشن تلگرام</h3>
        <div class="spacer"></div>
        <span class="pill ${on("tg_bot_token") && on("tg_chat_id") ? "ok" : "muted"}">
          ${on("tg_bot_token") && on("tg_chat_id") ? "فعال" : "غیرفعال"}
        </span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>فعال‌سازی ارسال به تلگرام</b><span>سفارش‌های جدید و رسیدهای آپلودشده به تلگرام شما ارسال می‌شوند و روی سرور ذخیره نمی‌شوند</span></div>
        <span class="pill info">${on("tg_bot_token") && on("tg_chat_id") ? "متصل" : "نیاز به تنظیم"}</span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>توکن ربات (Bot Token)</b><span>از <code dir="ltr">@BotFather</code> دریافت می‌شود — مثال: <code dir="ltr">123456:ABC-DEF...</code></span></div>
        <input class="search-box" id="gwTgToken" dir="ltr" placeholder="bot token" value="${esc(cfg.tg_bot_token || "")}" style="width:100%;max-width:380px" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>شناسه چت (Chat ID)</b><span>چت یا کانالی که پیام‌ها به آن ارسال می‌شوند — مثال: <code dir="ltr">123456789</code> یا <code dir="ltr">@channelname</code></span></div>
        <input class="search-box" id="gwTgChat" dir="ltr" placeholder="chat id" value="${esc(cfg.tg_chat_id || "")}" style="width:100%;max-width:380px" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>نحوه راه‌اندازی</b><span>۱) در تلگرام به <code dir="ltr">@BotFather</code> بگویید <code dir="ltr">/newbot</code> → ۲) توکن را اینجا بگذارید → ۳) به ربات پیام بدهید یا آن را ادمین کانال کنید → ۴) Chat ID را اینجا بگذارید.</span></div>
        <button class="btn btn-ghost" id="gwTgTest">🔔 تست ارسال</button>
      </div>
    </div>

    <div class="settings-card" style="margin-bottom:16px">
      <div class="table-head" style="padding:0 0 14px;border-bottom:1px solid var(--line)">
        <h3>📧 ایمیل تحویل لایسنس (SMTP)</h3>
        <div class="spacer"></div>
        <span class="pill ${on("smtp_host") && on("smtp_user") ? "ok" : "muted"}">
          ${on("smtp_host") && on("smtp_user") ? "فعال" : "غیرفعال"}
        </span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>ارسال خودکار لایسنس به ایمیل مشتری</b><span>وقتی پرداخت تأیید می‌شود، لایسنس‌ها به ایمیل مشتری ارسال می‌شوند. بدون تنظیم SMTP، لایسنس‌ها فقط در پنل ادمین قابل مشاهده‌اند.</span></div>
        <span class="pill info">${on("smtp_host") && on("smtp_user") ? "متصل" : "نیاز به تنظیم"}</span>
      </div>
      <div class="set-item">
        <div class="card-grid">
          <div class="field">
            <label>سرور SMTP (Host)</label>
            <input class="search-box" id="gwSmtpHost" dir="ltr" placeholder="smtp.gmail.com" value="${esc(cfg.smtp_host || "")}" style="width:100%" />
          </div>
          <div class="field">
            <label>پورت</label>
            <input class="search-box" id="gwSmtpPort" dir="ltr" inputmode="numeric" placeholder="587" value="${esc(cfg.smtp_port || "587")}" style="width:100%" />
          </div>
          <div class="field">
            <label>نام کاربری (ایمیل)</label>
            <input class="search-box" id="gwSmtpUser" dir="ltr" placeholder="you@example.com" value="${esc(cfg.smtp_user || "")}" style="width:100%" />
          </div>
          <div class="field">
            <label>رمز عبور / App Password</label>
            <input class="search-box" id="gwSmtpPass" dir="ltr" type="password" placeholder="••••••••" value="${esc(cfg.smtp_pass || "")}" style="width:100%" />
          </div>
        </div>
      </div>
      <div class="set-item">
        <div class="s-label"><b>نام و آدرس فرستنده</b><span>اختیاری — مثلاً <code dir="ltr">"زوریکس" &lt;noreply@zevrix.ir&gt;</code>. خالی بگذارید تا از نام کاربری استفاده شود.</span></div>
        <input class="search-box" id="gwSmtpFrom" dir="ltr" placeholder='"Zevrix" <noreply@zevrix.ir>' value="${esc(cfg.smtp_from || "")}" style="width:100%;max-width:380px" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>راهنمای جیمیل</b><span>برای جیمیل باید «App Password» بسازید (رمز معمولی کار نمی‌کند): حساب Google → امنیت → تأیید دو مرحله‌ای → App passwords → Mail.</span></div>
        <span class="pill warn">پورت ۴۶۵ یا ۵۸۷</span>
      </div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="gwSave">💾 ذخیره تنظیمات درگاه</button>
      <span id="gwHint" style="color:var(--muted);font-size:13px"></span>
    </div>`;

  const hint = (msg, err) => {
    const h = $("#gwHint");
    h.textContent = msg;
    h.style.color = err ? "var(--danger,#ff5c7a)" : "var(--muted)";
  };

  /* live-format card number in groups of 4 */
  const cardInput = $("#gwCardNumber");
  cardInput.addEventListener("input", () => {
    const digits = cardInput.value.replace(/\D/g, "").slice(0, 16);
    cardInput.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });

  /* test the Telegram bot */
  $("#gwTgTest").addEventListener("click", async () => {
    const btn = $("#gwTgTest");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "در حال ارسال…";
    try {
      const data = await api("/api/admin/payment/telegram/test", {
        method: "POST",
        body: {
          token: $("#gwTgToken").value.trim(),
          chat_id: $("#gwTgChat").value.trim()
        }
      });
      toast(data.ok ? "پیام تست به تلگرام ارسال شد ✓" : data.error || "ارسال ناموفق بود", !data.ok);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  $("#gwSave").addEventListener("click", async () => {
    const btn = $("#gwSave");
    btn.disabled = true;
    btn.textContent = "در حال ذخیره…";
    try {
      const merchant = $("#gwMerchant").value.trim();
      const cardDigits = cardInput.value.replace(/\D/g, "");
      if ($("#gwZarinpalEnabled").checked && !merchant) {
        hint("برای فعال‌سازی زرین‌پال، کد مرچنت را وارد کنید", true);
        btn.disabled = false;
        btn.textContent = "💾 ذخیره تنظیمات درگاه";
        return;
      }
      if ($("#gwCardEnabled").checked && cardDigits.length !== 16) {
        hint("شماره کارت باید ۱۶ رقم باشد", true);
        btn.disabled = false;
        btn.textContent = "💾 ذخیره تنظیمات درگاه";
        return;
      }
      await api("/api/admin/payment/gateways", {
        method: "PUT",
        body: {
          pg_zarinpal_enabled: $("#gwZarinpalEnabled").checked,
          pg_zarinpal_merchant: merchant,
          pg_zarinpal_sandbox: $("#gwSandbox").checked,
          pg_card_enabled: $("#gwCardEnabled").checked,
          pg_card_number: cardDigits,
          pg_card_holder: $("#gwCardHolder").value.trim(),
          pg_card_bank: $("#gwCardBank").value.trim(),
          pg_card_sheba: $("#gwCardSheba").value.trim(),
          pg_card_desc: $("#gwCardDesc").value.trim(),
          tg_bot_token: $("#gwTgToken").value.trim(),
          tg_chat_id: $("#gwTgChat").value.trim(),
          smtp_host: $("#gwSmtpHost").value.trim(),
          smtp_port: $("#gwSmtpPort").value.trim(),
          smtp_user: $("#gwSmtpUser").value.trim(),
          smtp_pass: $("#gwSmtpPass").value,
          smtp_from: $("#gwSmtpFrom").value.trim()
        }
      });
      toast("تنظیمات درگاه پرداخت ذخیره شد ✓");
      hint("");
      renderGateways();
    } catch (err) {
      toast(err.message, true);
      hint(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 ذخیره تنظیمات درگاه";
    }
  });
}

/* ============================================================
   SETTINGS
   ============================================================ */
async function renderSettings() {
  $("#content").innerHTML = `
    <div class="settings-card">
      <div class="table-head" style="padding:0 0 14px;border-bottom:1px solid var(--line)">
        <h3>⚙️ تنظیمات فروشگاه</h3>
      </div>
      <div class="set-item">
        <div class="s-label"><b>نام کاربری مدیر</b><span>برای ورود به پنل استفاده می‌شود</span></div>
        <span class="pill info" id="setAdminUser">—</span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>تغییر رمز عبور</b><span>رمز عبور جدید را وارد کنید</span></div>
        <input class="search-box" type="password" id="setNewPass" placeholder="رمز جدید" style="width:170px" />
      </div>
      <div class="set-item">
        <div class="s-label"><b>آدرس فروشگاه</b><span>صفحه اصلی سایت</span></div>
        <button class="btn btn-ghost btn-sm" id="openSite">باز کردن فروشگاه ↗</button>
      </div>
      <div class="set-item">
        <div class="s-label"><b>داده‌ها</b><span>محصولات و دسته‌ها از دیتابیس بارگذاری می‌شوند</span></div>
        <span class="pill ok">SQLite ✓</span>
      </div>
      <div class="set-item">
        <div class="s-label"><b>لوگوی فروشگاه</b><span>لوگوی هدر و فوتر سایت را تغییر دهید (حداکثر ۴ مگابایت — PNG/JPG/WebP/SVG)</span></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="logo-preview" id="logoPreview">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#lp)"/>
              <path d="M10 12.5 16 9l6 3.5v7L16 23l-6-3.5v-7Z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M10 12.5 16 16l6-3.5M16 16v7" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
              <defs><linearGradient id="lp" x1="2" y1="2" x2="30" y2="30"><stop stop-color="#6d5dfc"/><stop offset="1" stop-color="#00d4ff"/></linearGradient></defs>
            </svg>
            <img alt="لوگوی فعلی" />
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" class="hidden" />
            <button class="btn btn-ghost btn-sm" id="logoPick">📁 انتخاب فایل</button>
            <button class="btn btn-ghost btn-sm danger" id="logoRemove">حذف لوگو</button>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn btn-primary" id="savePass">ذخیره رمز عبور</button>
      </div>
    </div>`;

  try {
    const me = await api("/api/admin/me");
    $("#setAdminUser").textContent = me.admin.username;
  } catch { /* ignore */ }

  $("#openSite").addEventListener("click", () => window.open("/", "_blank"));

  /* ---- Logo upload ---- */
  const logoPreview = $("#logoPreview");
  const logoImg = logoPreview ? logoPreview.querySelector("img") : null;

  async function loadCurrentLogo() {
    try {
      const b = await api("/api/branding");
      if (b.logoUrl && logoImg) {
        logoImg.src = b.logoUrl;
        logoImg.style.display = "block";
        logoPreview.classList.add("has-img");
      }
    } catch { /* ignore */ }
  }
  loadCurrentLogo();

  $("#logoPick").addEventListener("click", () => $("#logoFile").click());
  $("#logoFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    try {
      const res = await api("/api/admin/branding/logo", { method: "POST", body: fd, isForm: true });
      toast("لوگو با موفقیت تغییر کرد ✓");
      if (logoImg) {
        logoImg.src = res.url;
        logoImg.style.display = "block";
        logoPreview.classList.add("has-img");
      }
    } catch (err) { toast(err.message, true); }
    e.target.value = "";
  });
  $("#logoRemove").addEventListener("click", async () => {
    try {
      await api("/api/admin/branding/logo", { method: "DELETE" });
      toast("لوگو حذف شد — به حالت پیش‌فرض برگشت ✓");
      if (logoImg) logoImg.style.display = "none";
      logoPreview.classList.remove("has-img");
    } catch (err) { toast(err.message, true); }
  });

  $("#savePass").addEventListener("click", async () => {
    const pass = $("#setNewPass").value;
    if (!pass || pass.length < 6) return toast("رمز عبور باید حداقل ۶ کاراکتر باشد", true);
    try {
      await api("/api/admin/password", {
        method: "PUT",
        body: { password: pass }
      });
      $("#setNewPass").value = "";
      toast("رمز عبور تغییر کرد ✓");
    } catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   BOOT
   ============================================================ */
(async function boot() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return showLogin();
  try {
    const me = await api("/api/admin/me");
    $("#adminChip").textContent = "👤 " + (me.admin.name || me.admin.username);
    showPanel();
  } catch {
    showLogin();
  }
})();
