/* ============================================================
   ZEVRIX — Main application logic
   ============================================================ */
(function () {
  "use strict";

  /* ---------- State ---------- */
  const state = {
    lang: localStorage.getItem("ds-lang") || "fa",
    cart: JSON.parse(localStorage.getItem("ds-cart") || "[]"),
    filter: "all",
    visible: 8,
    authMode: "login",
    route: "home"
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const t = (path) => {
    const parts = path.split(".");
    let v = I18N[state.lang];
    for (const p of parts) v = v && v[p];
    return v !== undefined ? v : path;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Star SVG ---------- */
  const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.6Z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m4 12.5 5 5L20 6.5"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CART_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.5l2.6 12.2A2 2 0 0 0 9 17h9.5a2 2 0 0 0 2-1.6L22 7H6"/></svg>';
  const EYE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>';

  /* ---------- Apply language ---------- */
  function applyLang() {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === "fa" ? "rtl" : "ltr";

    // Text nodes
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = t(key);
      if (!val) return;
      if (val.includes("<br>")) el.innerHTML = val;
      else el.textContent = val;
    });
    // Placeholders
    $$("[data-i18n-ph]").forEach((el) => {
      const val = t(el.getAttribute("data-i18n-ph"));
      if (val) el.placeholder = val;
    });

    // Language label + active states
    $("#langLabel").textContent = state.lang === "fa" ? "فارسی" : "English";
    $$("#langMenu button").forEach((b) =>
      b.classList.toggle("active", b.dataset.lang === state.lang)
    );
    $$(".footer__lang-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.lang === state.lang)
    );

    document.title = "ZEVRIX";
    localStorage.setItem("ds-lang", state.lang);
  }

  /* ---------- Render: categories ---------- */
  function renderCategories() {
    const grid = $("#categoriesGrid");
    grid.innerHTML = CATEGORIES.map((c) => {
      const count = PRODUCTS.filter((p) => p.cat === c.id).length;
      const g = (c.gradient && c.gradient.length === 2)
        ? c.gradient
        : [c.color || "#6d5dfc", "#00d4ff"];
      return `
      <button class="cat-card reveal" data-cat="${c.id}"
        style="--cat-color:${c.color};--cat-grad:linear-gradient(135deg,${g[0]},${g[1]})">
        <span class="cat-card__icon">${c.icon}</span>
        <h3>${t("cat." + c.id)}</h3>
        <p>${count}+ ${t("categories.count")}</p>
        <span class="cat-card__count">${count} ${t("categories.count")}</span>
        <span class="cat-card__arrow">${ARROW}</span>
      </button>`;
    }).join("");

    $$("#categoriesGrid .cat-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        /* VPN category has its own dedicated plans page (hash-routed) */
        if (cat === "vpn") {
          location.hash = "#/vpn";
          return;
        }
        state.filter = cat;
        state.visible = 8;
        renderProducts();
        const target = $("#products");
        target.scrollIntoView({ behavior: "smooth" });
        observeReveals();
      });
    });
  }

  /* ---------- Render: filters ---------- */
  function renderFilters() {
    const wrap = $("#filters");
    const items = [{ id: "all", label: t("filters.all") }].concat(
      CATEGORIES.map((c) => ({ id: c.id, label: t("cat." + c.id) }))
    );
    wrap.innerHTML = items
      .map(
        (i) =>
          `<button class="filter${i.id === state.filter ? " active" : ""}" data-filter="${i.id}">${esc(i.label)}</button>`
      )
      .join("");
    $$("#filters .filter").forEach((b) =>
      b.addEventListener("click", () => {
        /* VPN filter opens the dedicated plans page (hash-routed) */
        if (b.dataset.filter === "vpn") {
          location.hash = "#/vpn";
          return;
        }
        state.filter = b.dataset.filter;
        state.visible = 8;
        renderProducts();
      })
    );
  }

  /* ---------- Product card ---------- */
  function productCard(p, i) {
    const cat = CATEGORIES.find((c) => c.id === p.cat);
    const off = p.oldPrice
      ? Math.round((1 - p.price / p.oldPrice) * 100)
      : 0;
    const stars = Math.round(p.rating);
    return `
    <article class="product" data-id="${p.id}" style="animation-delay:${Math.min(i * 45, 400)}ms">
      <div class="product__media">
        <span class="product__icon">${p.icon}</span>
        <div class="product__badges">
          ${p.badge ? `<span class="product__badge">${esc(p.badge[state.lang])}</span>` : ""}
          ${off ? `<span class="product__badge product__badge--off">${toFaDigits(off)}٪ ${t("card.off")}</span>` : ""}
        </div>
        <span class="product__cat">${esc(t("cat." + p.cat))}</span>
      </div>
      <div class="product__body">
        <h3 class="product__name">${esc(p.name[state.lang])}</h3>
        <p class="product__desc">${esc(p.desc[state.lang])}</p>
        <div class="product__rating">
          <span class="stars">${STAR.repeat(stars)}</span>
          <b>${toFaDigits(p.rating)}</b>
          <span>(${formatNumber(p.reviews, state.lang)})</span>
        </div>
        <div class="product__price">
          <span class="price-now">${formatPrice(p.price, state.lang)}</span>
          ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice, state.lang)}</span>` : ""}
        </div>
        <div class="product__digital"><span class="dot"></span>${t("card.digital")}</div>
      </div>
      <div class="product__actions">
        <button class="btn btn--buy" data-add="${p.id}">${CART_ICON}<span>${t("card.buy")}</span></button>
        <button class="btn btn--outline btn--details" data-view="${p.id}" aria-label="${t("card.details")}">${EYE}</button>
      </div>
    </article>`;
  }

  /* ---------- Render: products ---------- */
  function renderProducts() {
    const grid = $("#productsGrid");
    const list =
      state.filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === state.filter);
    const shown = list.slice(0, state.visible);

    grid.innerHTML = shown.map(productCard).join("");
    $("#productsEmpty").hidden = shown.length > 0;

    const moreBtn = $("#loadMore");
    moreBtn.style.display = list.length > state.visible ? "inline-flex" : "none";
    moreBtn.innerHTML = `<span>${t("products.more")}</span>`;

    // re-render filters active state
    $$("#filters .filter").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === state.filter)
    );

    bindProductEvents(grid);
  }

  /* ---------- Render: bestsellers ---------- */
  function renderBestsellers() {
    const top = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 6);
    $("#bestsellersGrid").innerHTML = top
      .map((p, i) => {
        const stars = Math.round(p.rating);
        return `
      <div class="best reveal" style="transition-delay:${i * 60}ms">
        <span class="best__rank">${toFaDigits(i + 1)}</span>
        <span class="best__icon">${p.icon}</span>
        <div class="best__info">
          <div class="best__name">${esc(p.name[state.lang])}</div>
          <div class="best__meta">
            <span class="stars">${STAR.repeat(stars)}</span>
            <b>${toFaDigits(p.rating)}</b>
            <span>·</span>
            <span>${formatNumber(p.sold, state.lang)} ${t("card.sold")}</span>
          </div>
        </div>
        <span class="best__price">${formatPrice(p.price, state.lang)}</span>
        <button class="best__buy" data-add="${p.id}" aria-label="${t("card.buy")}">${CART_ICON}</button>
      </div>`;
      })
      .join("");
    bindProductEvents($("#bestsellersGrid"));
  }

  /* ---------- Render: features / testimonials / faq ---------- */
  function renderFeatures() {
    $("#featuresGrid").innerHTML = FEATURES.map((f, i) => `
      <div class="feature reveal" style="transition-delay:${i * 60}ms">
        <div class="feature__icon">${f.icon}</div>
        <h3>${esc(f.title[state.lang])}</h3>
        <p>${esc(f.desc[state.lang])}</p>
      </div>`).join("");
  }

  function renderTestimonials() {
    $("#testimonialsGrid").innerHTML = TESTIMONIALS.map((r, i) => `
      <div class="testi reveal" style="transition-delay:${i * 60}ms">
        <div class="testi__top">
          <span class="testi__avatar" style="--av:${r.color};background:${r.color}">${esc(r.avatar)}</span>
          <div>
            <div class="testi__name">${esc(r.name)}</div>
            <div class="testi__role">${esc(r.role[state.lang])}</div>
          </div>
        </div>
        <p class="testi__text">${esc(r.text[state.lang])}</p>
        <div class="testi__stars">${STAR.repeat(r.rating)}</div>
      </div>`).join("");
  }

  function renderFaq() {
    $("#faqList").innerHTML = FAQS.map((f, i) => `
      <div class="faq-item reveal" style="transition-delay:${i * 40}ms">
        <button class="faq-q" aria-expanded="false">
          <span>${esc(f.q[state.lang])}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="faq-a"><p>${esc(f.a[state.lang])}</p></div>
      </div>`).join("");

    $$("#faqList .faq-q").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.parentElement;
        const open = item.classList.contains("open");
        $$("#faqList .faq-item").forEach((it) => {
          it.classList.remove("open");
          it.querySelector(".faq-a").style.maxHeight = null;
          it.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("open");
          const a = item.querySelector(".faq-a");
          a.style.maxHeight = a.scrollHeight + "px";
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ---------- Product modal ---------- */
  function openProductModal(id) {
    const p = PRODUCTS.find((x) => x.id === id || x.id === Number(id));
    if (!p) return;
    const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

    $("#modalBox").innerHTML = `
      <div class="modal__hero">
        <span class="product__icon">${p.icon}</span>
        <button class="modal__close" id="modalClose" aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body">
        <h3>${esc(p.name[state.lang])}</h3>
        <div class="modal__tags">
          <span class="modal__tag">${esc(t("cat." + p.cat))}</span>
          <span class="modal__tag modal__tag--ok">${t("modal.license")}</span>
          <span class="modal__tag modal__tag--ok">${t("modal.delivery")}</span>
          ${off ? `<span class="modal__tag">${toFaDigits(off)}٪ ${t("card.off")}</span>` : ""}
        </div>
        <div class="modal__price">
          <span class="price-now">${formatPrice(p.price, state.lang)}</span>
          ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice, state.lang)}</span>` : ""}
          <span style="margin-inline-start:auto;font-size:13px;color:var(--muted)">
            <span class="stars" style="display:inline-flex;vertical-align:middle">${STAR.repeat(Math.round(p.rating))}</span>
            <b>${toFaDigits(p.rating)}</b> (${formatNumber(p.reviews, state.lang)})
          </span>
        </div>
        <div class="modal__section">
          <h4>${t("modal.desc")}</h4>
          <p>${esc(p.desc[state.lang])}</p>
        </div>
        <div class="modal__section">
          <h4>${t("modal.specs")}</h4>
          <div class="modal__specs">
            ${p.specs[state.lang].map((s) => `<div class="modal__spec">${CHECK}<span>${esc(s)}</span></div>`).join("")}
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--primary btn--lg" data-add="${p.id}">${CART_ICON}<span>${t("modal.buy")}</span></button>
          <button class="btn btn--outline btn--lg" id="modalCloseBtn">${t("card.details")}</button>
        </div>
      </div>`;

    $("#productModal").classList.add("open");
    $("#overlay").classList.add("open");
    document.body.classList.add("no-scroll");
    $("#modalClose").addEventListener("click", closeProductModal);
    $("#modalCloseBtn").addEventListener("click", closeProductModal);
    bindProductEvents($("#modalBox"));
  }

  function closeProductModal() {
    $("#productModal").classList.remove("open");
    if (!isAnyDrawerOpen()) {
      $("#overlay").classList.remove("open");
      document.body.classList.remove("no-scroll");
    }
  }

  /* ---------- Payment ---------- */
  let payMethods = null;

  /* Ask for email in a modal (prompt() is blocked in many browsers) */
  function askEmail() {
    return new Promise((resolve) => {
      const old = $("#emailBackdrop");
      if (old) old.remove();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.id = "emailBackdrop";
      backdrop.innerHTML = `
        <div class="pay-modal" style="max-width:420px">
          <div class="modal-head">
            <h3>📧 ${t("toast.needEmail")}</h3>
            <button class="icon-btn" id="emailClose">✕</button>
          </div>
          <form id="emailForm">
            <div class="modal-body">
              <div class="field">
                <input type="email" id="emailInput" dir="ltr" placeholder="name@example.com" required
                       style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--text);font-family:inherit" />
              </div>
            </div>
            <div class="modal-foot">
              <button type="submit" class="btn btn--primary btn--block">${t("cart.checkout")}</button>
            </div>
          </form>
        </div>`;

      document.body.appendChild(backdrop);
      document.body.classList.add("no-scroll");
      const input = $("#emailInput", backdrop);
      input.focus();

      const close = (val) => {
        backdrop.remove();
        document.body.classList.remove("no-scroll");
        resolve(val);
      };

      $("#emailClose", backdrop).addEventListener("click", () => close(null));
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(null);
      });

      $("#emailForm", backdrop).addEventListener("submit", (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          toast(t("toast.needEmail"), "err");
          input.focus();
          return;
        }
        close(v);
      });
    });
  }

  async function loadPayMethods() {
    if (payMethods) return payMethods;
    try {
      const res = await fetch("/api/payment/methods");
      payMethods = await res.json();
    } catch { payMethods = null; }
    return payMethods;
  }

  function toFaDigits(s) {
    return String(s || "").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function copyText(text, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = "✓";
      setTimeout(() => { btn.textContent = old; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, btn, done));
    } else fallbackCopy(text, btn, done);
  }

  function fallbackCopy(text, btn, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch { /* ignore */ }
    ta.remove();
  }

  async function openPayment(ref, total) {
    const methods = await loadPayMethods();
    const zp = methods && methods.zarinpal;
    const card = methods && methods.card;

    if (!zp || !zp.enabled) delete methods.zarinpal;
    if (!card || !card.enabled) delete methods.card;

    if (!methods || (!methods.zarinpal && !methods.card)) {
      toast(t("pay.noMethod"), "err");
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "payBackdrop";
    backdrop.innerHTML = `
      <div class="pay-modal">
          <h3>💳 ${t("pay.title")}</h3>
          <button class="icon-btn" id="payClose">✕</button>
        </div>
        <div class="modal-body">
          <div class="pay-methods" id="payMethods"></div>
          <div class="pay-card-info" id="payCardInfo"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn--primary btn--block" id="payAction" disabled>…</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.classList.add("no-scroll");

    const rows = $("#payMethods");
    const cardInfo = $("#payCardInfo");
    const actionBtn = $("#payAction");
    let selected = null;

    rows.innerHTML = [
      methods.zarinpal ? { key: "zarinpal", name: t("pay.zarinpal"), desc: t("pay.zarinpalDesc"), ico: "🌐" } : null,
      methods.card ? { key: "card", name: t("pay.card"), desc: t("pay.cardDesc"), ico: "🏦" } : null
    ].filter(Boolean).map((m) => `
      <label class="pay-method" data-method="${m.key}">
        <input type="radio" name="payMethod" value="${m.key}" />
        <span class="pay-method__radio"></span>
        <span class="pay-method__body">
          <span class="pay-method__name">${m.ico} ${esc(m.name)}</span>
          <span class="pay-method__desc">${esc(m.desc)}</span>
        </span>
      </label>`).join("");

    function selectMethod(key) {
      selected = key;
      $$(".pay-method", backdrop).forEach((el) =>
        el.classList.toggle("selected", el.dataset.method === key)
      );
      if (key === "card" && methods.card) {
        const c = methods.card;
        cardInfo.classList.add("show");
        cardInfo.innerHTML = `
          <h4>${t("pay.cardHolder")}: ${esc(c.holder || "—")}</h4>
          ${[
            ["pay.cardNumber", c.number, 16],
            ["pay.cardBank", c.bank, null],
            ["pay.cardSheba", c.sheba, null]
          ].filter(([, v]) => v).map(([label, v]) => `
            <div class="pay-row">
              <span>${t(label)}</span>
              <b dir="ltr">${esc(v)}</b>
              <button type="button" class="pay-copy" data-copy="${esc(v)}">کپی</button>
            </div>`).join("")}
          ${c.desc ? `<div class="pay-row"><span>توضیحات</span><b style="font-weight:500;max-width:60%;text-align:left" dir="rtl">${esc(c.desc)}</b></div>` : ""}
          <div class="pay-upload">
            <div class="field">
              <label>${t("pay.receiptHint")}</label>
              <input type="file" id="receiptFile" accept="image/png,image/jpeg,image/webp,application/pdf" />
            </div>
            <div class="field">
              <label>${t("pay.receiptNote")}</label>
              <input type="text" id="receiptNote" placeholder="…" />
            </div>
            <button class="btn btn--ghost" id="receiptSend">${t("pay.uploadReceiptBtn")} ↑</button>
          </div>`;
        actionBtn.style.display = "none";
        $("#receiptSend").addEventListener("click", () => uploadReceipt(ref));
        $$("[data-copy]", cardInfo).forEach((b) =>
          b.addEventListener("click", () => copyText(b.dataset.copy, b))
        );
      } else {
        cardInfo.classList.remove("show");
        cardInfo.innerHTML = "";
        actionBtn.style.display = "block";
        actionBtn.textContent = t("pay.payNow");
      }
    }

    $$(".pay-method", backdrop).forEach((el) =>
      el.addEventListener("click", () => selectMethod(el.dataset.method))
    );

    const first = $(".pay-method", backdrop);
    if (first) selectMethod(first.dataset.method);

    $("#payClose").addEventListener("click", closePayment);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePayment();
    });

    actionBtn.addEventListener("click", () => {
      if (selected === "zarinpal") startZarinpal(ref, actionBtn);
    });
  }

  function closePayment() {
    const b = $("#payBackdrop");
    if (b) b.remove();
    document.body.classList.remove("no-scroll");
  }

  async function startZarinpal(ref, btn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t("pay.redirecting");
    try {
      const res = await fetch("/api/payment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, method: "zarinpal" })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "error");
      window.location.href = data.payUrl;
    } catch (e) {
      toast(t("pay.payFail"), "err");
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function uploadReceipt(ref) {
    const fileInput = $("#receiptFile");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return toast(t("pay.uploadReceipt"), "err");
    const btn = $("#receiptSend");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "...";
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      fd.append("ref", ref);
      fd.append("note", ($("#receiptNote") || {}).value || "");
      const res = await fetch("/api/payment/receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "error");
      toast(t("pay.receiptOk"), "ok");
      closePayment();
    } catch (e) {
      toast(t("pay.receiptFail"), "err");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  /* ---------- End payment ---------- */
  function saveCart() {
    localStorage.setItem("ds-cart", JSON.stringify(state.cart));
  }
  function addToCart(id) {
    const p = PRODUCTS.find((x) => x.id === id || x.id === Number(id));
    if (!p) return;
    const found = state.cart.find((i) => i.id === p.id);
    if (found) found.qty += 1;
    else state.cart.push({ id: p.id, qty: 1 });
    saveCart();
    updateCartUI(true);
    toast(t("toast.cart"), "ok");
  }
  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== Number(id));
    saveCart();
    updateCartUI();
    toast(t("cart.removed"));
  }

  function updateCartUI(bump) {
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    const badge = $("#cartCount");
    badge.textContent = toFaDigits(count);
    badge.classList.toggle("show", count > 0);
    if (bump) {
      badge.classList.remove("bump");
      void badge.offsetWidth;
      badge.classList.add("bump");
    }

    const items = $("#cartItems");
    if (!state.cart.length) {
      items.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">🛒</div>
          <h4>${t("cart.empty")}</h4>
          <p>${t("cart.emptyHint")}</p>
        </div>`;
      $("#cartFoot").style.display = "none";
    } else {
      let total = 0;
      items.innerHTML = state.cart
        .map((i) => {
          const p = PRODUCTS.find((x) => x.id === i.id);
          if (!p) return "";
          total += p.price * i.qty;
          return `
          <div class="cart-item">
            <span class="cart-item__icon">${p.icon}</span>
            <div class="cart-item__info">
              <div class="cart-item__name">${esc(p.name[state.lang])} ${i.qty > 1 ? `<b>× ${toFaDigits(i.qty)}</b>` : ""}</div>
              <div class="cart-item__price">${formatPrice(p.price * i.qty, state.lang)}</div>
            </div>
            <button class="cart-item__remove" data-remove="${p.id}" aria-label="Remove">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </div>`;
        })
        .join("");
      $("#cartFoot").style.display = "flex";
      $("#cartTotal").textContent = formatPrice(total, state.lang);
      $$("[data-remove]", items).forEach((b) =>
        b.addEventListener("click", () => removeFromCart(b.dataset.remove))
      );
    }
  }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    const el = document.createElement("div");
    el.className = "toast" + (type === "ok" ? " toast--ok" : type === "err" ? " toast--err" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, type === "ok" || type === "err" ? 4200 : 2600);
  }

  /* ---------- Search ---------- */
  function runSearch(q) {
    const box = $("#searchResults");
    const term = q.trim().toLowerCase();
    if (!term) {
      box.innerHTML = "";
      return;
    }
    const results = PRODUCTS.filter((p) =>
      (p.name.fa + " " + p.name.en + " " + p.desc.fa + " " + p.desc.en + " " + p.cat)
        .toLowerCase()
        .includes(term)
    );
    if (!results.length) {
      box.innerHTML = `<div class="search-empty">${t("search.noResult")}</div>`;
      return;
    }
    box.innerHTML = results
      .map((p) => `
      <button class="search-result" data-view="${p.id}">
        <span class="search-result__icon">${p.icon}</span>
        <span>
          <span class="search-result__name">${esc(p.name[state.lang])}</span>
          <span class="search-result__meta">${esc(t("cat." + p.cat))}</span>
        </span>
        <span class="search-result__price">${formatPrice(p.price, state.lang)}</span>
      </button>`).join("");
    bindProductEvents(box);
  }

  /* ---------- Bind product events inside a container ---------- */
  function bindProductEvents(root) {
    $$("[data-add]", root).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(b.dataset.add);
      })
    );
    $$("[data-view]", root).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        closeSearch();
        openProductModal(b.dataset.view);
      })
    );
  }

  /* ---------- Drawers ---------- */
  function isAnyDrawerOpen() {
    return (
      $("#cartDrawer").classList.contains("open") ||
      $("#authDrawer").classList.contains("open") ||
      $("#productModal").classList.contains("open")
    );
  }
  function closeAll() {
    $("#cartDrawer").classList.remove("open");
    $("#authDrawer").classList.remove("open");
    $("#productModal").classList.remove("open");
    $("#overlay").classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  /* ---------- Reveal on scroll ---------- */
  let revealObserver = null;
  function observeReveals() {
    if (revealObserver) revealObserver.disconnect();
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((el) => el.classList.add("visible"));
      return;
    }
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            revealObserver.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $$(".reveal:not(.visible)").forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Counters ---------- */
  function animateCounters() {
    $$(".stat__num").forEach((el) => {
      const target = Number(el.dataset.count);
      const isFa = state.lang === "fa";
      let started = false;
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          const dur = 1600;
          const start = performance.now();
          const step = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const val = Math.round(target * eased);
            el.textContent = isFa
              ? toFaDigits(val.toLocaleString("fa-IR"))
              : val.toLocaleString("en-US");
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          io.disconnect();
        }
      }, { threshold: 0.4 });
      io.observe(el);
    });
  }

  /* ---------- Header / scroll ---------- */
  function onScroll() {
    const y = window.scrollY;
    $("#header").classList.toggle("scrolled", y > 20);
    $("#backTop").classList.toggle("show", y > 500);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    $("#scrollProgress").style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  }

  /* ---------- Search panel ---------- */
  function openSearch() {
    $("#searchPanel").classList.add("open");
    setTimeout(() => $("#searchInput").focus(), 200);
  }
  function closeSearch() {
    $("#searchPanel").classList.remove("open");
  }

  /* ---------- Auth ---------- */
  function setAuthMode(mode) {
    state.authMode = mode;
    $("#authTitle").textContent = t(mode === "login" ? "auth.loginTitle" : "auth.registerTitle");
    $("#authSubmit").textContent = t(mode === "login" ? "auth.loginBtn" : "auth.registerBtn");
    $("#authSwitch").innerHTML =
      (mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")) +
      ` <b>${mode === "login" ? t("auth.registerLink") : t("auth.loginLink")}</b>`;
    $("#authSwitchBtn").textContent =
      mode === "login" ? t("auth.registerLink") : t("auth.loginLink");
  }

  /* ---------- Full re-render on language change ---------- */
  function renderAll() {
    applyLang();
    renderCategories();
    renderFilters();
    renderProducts();
    renderBestsellers();
    renderFeatures();
    renderTestimonials();
    renderFaq();
    updateCartUI();
    setAuthMode(state.authMode);
    if (state.route === "vpn") renderVpnPage();
    observeReveals();
  }

  /* ---------- VPN plans page ---------- */
  function vpnPlans() {
    return PRODUCTS.filter((p) => p.isVpn);
  }

  function renderVpnPage() {
    const wrap = $("#vpnPage");
    if (!wrap) return;
    const plans = vpnPlans();

    wrap.innerHTML = `
      <div class="container">
        <button class="vpn-back" id="vpnBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
          <span>${t("vpnPage.back")}</span>
        </button>
        <div class="vpn-page__head">
          <span class="vpn-page__badge">🌐 ${t("vpnPage.badge")}</span>
          <h1 class="vpn-page__title">${t("vpnPage.title")}</h1>
          <p class="vpn-page__sub">${t("vpnPage.sub")}</p>
        </div>
        ${
          plans.length
            ? `<div class="vpn-plans">${plans.map(vpnPlanCard).join("")}</div>`
            : `<div class="vpn-empty">
                 <div class="vpn-empty__icon">🌐</div>
                 <h3>${t("vpnPage.empty")}</h3>
                 <p>${t("vpnPage.emptyHint")}</p>
               </div>`
        }
      </div>`;

    const back = $("#vpnBack");
    if (back) back.addEventListener("click", () => go("home"));
    bindProductEvents(wrap);
  }

  function vpnPlanCard(p, i) {
    const specs = (p.specs && p.specs[state.lang]) || [];
    return `
    <article class="vpn-plan reveal" data-id="${p.id}" style="animation-delay:${Math.min(i * 50, 350)}ms">
      <div class="vpn-plan__top">
        <span class="vpn-plan__icon">${p.icon || "🌐"}</span>
        <h3 class="vpn-plan__name">${esc(p.name[state.lang])}</h3>
        <span class="vpn-plan__tag">${t("vpnPage.instant")}</span>
      </div>
      ${p.desc && p.desc[state.lang] ? `<p class="vpn-plan__cat">${esc(p.desc[state.lang])}</p>` : ""}
      <div class="vpn-plan__price">
        <b>${formatPrice(p.price, state.lang)}</b>
      </div>
      <div class="vpn-plan__specs">
        ${specs.map((s) => `<div class="vpn-plan__spec">${CHECK}<span>${esc(s)}</span></div>`).join("")}
      </div>
      <div class="vpn-plan__foot">
        <button class="btn btn--primary" data-add="${p.id}">${CART_ICON}<span>${t("vpnPage.buy")}</span></button>
        <button class="btn btn--ghost btn--block" data-view="${p.id}" style="margin-top:8px">${t("card.details")}</button>
      </div>
    </article>`;
  }

  /* ---------- Simple client-side router (home / vpn) ---------- */
  function go(route, opts) {
    state.route = route;
    const home = $("#mainContent");
    const vpn = $("#vpnPage");
    if (!home || !vpn) return;

    if (route === "vpn") {
      home.hidden = true;
      vpn.hidden = false;
      renderVpnPage();
    } else {
      vpn.hidden = true;
      home.hidden = false;
    }
    /* keep the address bar in sync (silent — no extra history entry) */
    const want = route === "vpn" ? "#/vpn" : "";
    if ((location.hash || "") !== want) {
      history.replaceState(null, "", (want ? want : location.pathname + location.search));
    }
    if (!(opts && opts.keepScroll)) window.scrollTo({ top: 0, behavior: "auto" });
    onScroll();
    observeReveals();
  }

  function syncRoute() {
    const hash = location.hash || "";
    if (hash.startsWith("#/vpn")) go("vpn");
    else if (state.route === "vpn") go("home");
  }

  /* ---------- Load data from backend (falls back to static data.js) ---------- */
  async function loadData() {
    try {
      const [cats, prods, brand] = await Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/branding").then((r) => r.json())
      ]);
      /* CATEGORIES/PRODUCTS are `const` in data.js → mutate in place */
      if (Array.isArray(cats) && cats.length) {
        CATEGORIES.length = 0;
        cats.forEach((c) => CATEGORIES.push(c));
      }
      if (Array.isArray(prods) && prods.length) {
        PRODUCTS.length = 0;
        prods.forEach((p) => PRODUCTS.push(p));
      }
      if (brand && brand.logoUrl) applyLogo(brand.logoUrl);
    } catch (e) {
      /* offline / static file → keep using data.js */
    }
  }

  /* ---------- Apply custom logo from admin panel ---------- */
  function applyLogo(url) {
    if (!url) return;
    $$(".logo__mark").forEach((mark) => {
      let img = mark.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "ZEVRIX";
        mark.appendChild(img);
      }
      img.src = url;
      mark.classList.add("has-img");
    });
  }

  /* ---------- Init ---------- */
  async function init() {
    await loadData();
    renderAll();
    animateCounters();
    onScroll();

    // Language
    $("#langBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      $("#langMenu").classList.toggle("open");
    });
    $$("#langMenu button").forEach((b) =>
      b.addEventListener("click", () => {
        state.lang = b.dataset.lang;
        $("#langMenu").classList.remove("open");
        renderAll();
      })
    );
    $$(".footer__lang-btn").forEach((b) =>
      b.addEventListener("click", () => {
        state.lang = b.dataset.lang;
        renderAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );

    // Mobile nav
    $("#menuBtn").addEventListener("click", () => {
      $("#nav").classList.add("open");
      $("#overlay").classList.add("open");
      document.body.classList.add("no-scroll");
    });
    $("#navClose").addEventListener("click", () => {
      $("#nav").classList.remove("open");
      if (!isAnyDrawerOpen()) {
        $("#overlay").classList.remove("open");
        document.body.classList.remove("no-scroll");
      }
    });
    $$("#nav a").forEach((a) =>
      a.addEventListener("click", () => {
        $("#nav").classList.remove("open");
        if (!isAnyDrawerOpen()) {
          $("#overlay").classList.remove("open");
          document.body.classList.remove("no-scroll");
        }
      })
    );

    // Search
    $("#searchToggle").addEventListener("click", () => {
      const panel = $("#searchPanel");
      panel.classList.contains("open") ? closeSearch() : openSearch();
    });
    $("#searchClose").addEventListener("click", closeSearch);
    let searchTimer;
    $("#searchInput").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(e.target.value), 160);
    });

    // Cart
    $("#cartBtn").addEventListener("click", () => {
      closeSearch();
      $("#cartDrawer").classList.add("open");
      $("#overlay").classList.add("open");
      document.body.classList.add("no-scroll");
    });
    $("#cartClose").addEventListener("click", closeAll);
    $("#checkoutBtn").addEventListener("click", async () => {
      if (!state.cart.length) {
        toast(t("toast.emptyCart"));
        return;
      }
      const email = await askEmail();
      if (!email) return;

      const btn = $("#checkoutBtn");
      const original = btn.textContent;
      btn.textContent = "...";
      btn.disabled = true;
      try {
        const items = state.cart.map((i) => {
          const p = PRODUCTS.find((x) => x.id === i.id);
          return { id: i.id, name: p ? p.name.fa : "", qty: i.qty, price: p ? p.price : 0 };
        });
        const total = items.reduce((s, i) => s + i.price * i.qty, 0);
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer: email.split("@")[0], email: email.trim(), items, total })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "error");
        state.cart = [];
        saveCart();
        updateCartUI();
        closeAll();
        openPayment(data.ref, total);
      } catch (e) {
        toast(t("toast.orderFail"), "err");
      } finally {
        btn.textContent = original;
        btn.disabled = false;
      }
    });

    // Auth
    $$("[data-open-auth]").forEach((b) =>
      b.addEventListener("click", () => {
        closeSearch();
        setAuthMode(b.dataset.openAuth);
        $("#authDrawer").classList.add("open");
        $("#overlay").classList.add("open");
        document.body.classList.add("no-scroll");
      })
    );
    $("#authClose").addEventListener("click", closeAll);
    $("#authSwitch").addEventListener("click", () => {
      setAuthMode(state.authMode === "login" ? "register" : "login");
    });
    $("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      closeAll();
      toast(t("auth.success"), "ok");
    });

    // Overlay / misc
    $("#overlay").addEventListener("click", () => {
      closeAll();
      $("#nav").classList.remove("open");
    });
    $("#backTop").addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    $("#loadMore").addEventListener("click", () => {
      state.visible += 8;
      renderProducts();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAll();
        $("#nav").classList.remove("open");
        closeSearch();
      }
      // "/" focuses search
      if (
        e.key === "/" &&
        !/input|textarea/i.test(document.activeElement.tagName)
      ) {
        e.preventDefault();
        openSearch();
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".lang")) $("#langMenu").classList.remove("open");
    });

    // Scroll listener (passive)
    window.addEventListener("scroll", onScroll, { passive: true });

    // Year
    $("#year").textContent = new Date().getFullYear();

    // VPN plans page: deep links (#/vpn) + footer/nav links
    $$("[data-go-vpn]").forEach((b) =>
      b.addEventListener("click", () => {
        closeSearch();
        closeAll();
      })
    );
    window.addEventListener("hashchange", syncRoute);
    syncRoute();

    // A.R.I.A cinematic hero
    initAria();
  }

  /* ---------- A.R.I.A hero: typewriter + mouse-scrub video ---------- */
  function initAria() {
    const video = $("#ariaVideo");
    const typeEl = $("#ariaType");
    const pills = $("#ariaPills");
    const copyBtn = $("#ariaCopy");
    if (!video || !typeEl || !pills) return;

    const SENSITIVITY = 0.25;
    const REANCHOR_MS = 600;       // ms of mouse inactivity after which scrubbing re-anchors
    const TYPE_SPEED = 38;
    const TYPE_DELAY = 600;
    let targetTime = 0;
    let prevX = null;
    let lastMove = 0;
    let seeking = false;
    let typed = false;

    /* The <video> has landscape + portrait <source> elements. Browsers pick
       the right one on first load, but do NOT re-evaluate when the device
       rotates — force a reload of the matching source on orientation change. */
    const portraitMQ = window.matchMedia("(orientation: portrait)");
    function pickSource() {
      const wantPortrait = portraitMQ.matches;
      const sources = [...video.querySelectorAll("source")];
      const match = sources.find((s) =>
        wantPortrait ? s.media.includes("portrait") : s.media.includes("landscape")
      );
      if (match && video.currentSrc !== match.src) {
        const wasPlaying = !video.paused;
        for (const s of sources) video.removeChild(s);
        video.src = match.src;
        video.load();
        video.addEventListener(
          "canplay",
          function once() {
            video.removeEventListener("canplay", once);
            if (wasPlaying) video.play().catch(() => {});
          }
        );
      }
    }
    pickSource(); // correct the browser's initial pick if it got it wrong
    if (portraitMQ.addEventListener) portraitMQ.addEventListener("change", pickSource);
    else if (portraitMQ.addListener) portraitMQ.addListener(pickSource);

    /* pills appear 400ms after load (independent of typing) */
    setTimeout(() => pills.classList.add("show"), 400);

    /* typewriter — re-runs on language change via renderAll() */
    let typeRun = 0;
    function runTypewriter() {
      const run = ++typeRun;
      typeEl.innerHTML = "";
      typed = false;
      const text = t("aria.type");
      let i = 0;
      setTimeout(() => {
        const timer = setInterval(() => {
          if (run !== typeRun) { clearInterval(timer); return; }
          i++;
          typeEl.textContent = text.slice(0, i);
          if (!typed) {
            typeEl.insertAdjacentHTML("beforeend", '<span class="aria-cursor"></span>');
          }
          if (i >= text.length) {
            clearInterval(timer);
            typed = true;
            typeEl.textContent = text;
          }
        }, TYPE_SPEED);
      }, TYPE_DELAY);
    }
    runTypewriter();
    // re-run typewriter whenever language changes
    const origRenderAll = renderAll;
    renderAll = function () {
      origRenderAll();
      runTypewriter();
    };

    /* mouse-scrub video */
    function seekTo(v) {
      if (seeking) return;
      seeking = true;
      try { video.currentTime = v; } catch (e) { seeking = false; }
    }
    video.addEventListener("seeked", () => {
      seeking = false;
      if (Math.abs(targetTime - video.currentTime) > 0.05) seekTo(targetTime);
    });

    /* mobile autoplay: browsers block play() until the first user gesture */
    function ensurePlaying() {
      if (video.paused) {
        video.play().catch(function () { /* still blocked - retry next gesture */ });
      }
      window.removeEventListener("pointerdown", ensurePlaying);
      window.removeEventListener("keydown", ensurePlaying);
    }
    window.addEventListener("pointerdown", ensurePlaying);
    window.addEventListener("keydown", ensurePlaying);

    /* parallax drift removed: the robot video is full-frame, so nudging it
       vertically only pushed the robot's head under the fixed header. */

    window.addEventListener("mousemove", (e) => {
      if (!video.duration || !isFinite(video.duration)) return;
      const now = performance.now();

      // If the mouse has been idle, re-anchor to the live playhead so the
      // first drag movement is relative to what's actually on screen.
      if (prevX === null || now - lastMove > REANCHOR_MS) {
        prevX = e.clientX;
        lastMove = now;
        targetTime = video.currentTime;
        return;
      }

      const dx = e.clientX - prevX;
      prevX = e.clientX;
      lastMove = now;
      if (dx === 0) return;

      const offset = (dx / window.innerWidth) * SENSITIVITY * video.duration;
      // Wrap around so scrubbing past either end continues from the other
      // side instead of clamping to a dead stop.
      const d = video.duration;
      let clamped = targetTime + offset;
      if (d > 0) clamped = ((clamped % d) + d) % d;
      targetTime = clamped;
      if (!seeking) seekTo(clamped);
    });
    window.addEventListener("blur", () => { prevX = null; });
    document.addEventListener("mouseleave", () => { prevX = null; });

    /* copy email */
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText("support@zevrix.com");
          toast(t("aria.copied"), "ok");
        } catch (e) {
          toast(t("aria.copied"), "err");
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
