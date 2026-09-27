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
    authMode: "login"
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
      return `
      <button class="cat-card reveal" data-cat="${c.id}"
        style="--cat-color:${c.color};--cat-grad:linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})">
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
    const p = PRODUCTS.find((x) => x.id === Number(id));
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

  /* ---------- Cart ---------- */
  function saveCart() {
    localStorage.setItem("ds-cart", JSON.stringify(state.cart));
  }
  function addToCart(id) {
    const p = PRODUCTS.find((x) => x.id === Number(id));
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
    observeReveals();
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
      const email = prompt(t("toast.needEmail"), "");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        if (email !== null) toast(t("toast.needEmail"));
        return;
      }
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
        toast(t("toast.orderOk") + " " + data.ref, "ok");
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

    const SENSITIVITY = 0.8;
    const PARALLAX = 46;          // max px the video drifts vertically
    const PARALLAX_X = 26;        // max px the video drifts horizontally
    const PARALLAX_SCALE = 1.16;  // oversized so drift never exposes edges
    const TYPE_SPEED = 38;
    const TYPE_DELAY = 600;
    let targetTime = 0;
    let prevX = null;
    let prevY = null;
    let seeking = false;
    let typed = false;
    let parallaxFrame = 0;

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
    /* parallax drift: mouse position nudges the video, so the character
       appears to move up/down (and left/right) inside the frame */
    function applyParallax(mx, my) {
      cancelAnimationFrame(parallaxFrame);
      parallaxFrame = requestAnimationFrame(() => {
        const nx = (mx / window.innerWidth) * 2 - 1;   // -1 … 1
        const ny = (my / window.innerHeight) * 2 - 1;  // -1 … 1
        const ty = ny * PARALLAX;
        const tx = nx * PARALLAX_X;
        video.style.transform =
          "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + PARALLAX_SCALE + ")";
      });
    }

    window.addEventListener("mousemove", (e) => {
      if (!video.duration || !isFinite(video.duration)) return;
      if (prevX === null || prevY === null) {
        prevX = e.clientX;
        prevY = e.clientY;
        applyParallax(e.clientX, e.clientY);
        return;
      }
      // horizontal scrub (left/right → time)
      const dx = e.clientX - prevX;
      // vertical scrub (up/down → time, same direction as horizontal)
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      if (dx === 0 && dy === 0) {
        applyParallax(e.clientX, e.clientY);
        return;
      }
      const offset =
        ((dx / window.innerWidth) + (dy / window.innerHeight)) *
        SENSITIVITY *
        video.duration;
      targetTime = Math.min(Math.max(targetTime + offset, 0), video.duration);
      if (!seeking) seekTo(targetTime);
      applyParallax(e.clientX, e.clientY);
    });
    window.addEventListener("blur", () => { prevX = null; prevY = null; });
    document.addEventListener("mouseleave", () => { prevX = null; prevY = null; });

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
