"use strict";

/* =====================================================
   Data — loaded live from Supabase (see supabase-client.js)
===================================================== */

let mediaItems = [];

function mapTitleRow(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    titleEn: r.title_en || "",
    year: r.year,
    genre: r.genre || "",
    tags: r.tags || [],
    rating: r.rating || 0,
    status: r.status,
    episodeLabel: r.episode_label || "",
    duration: r.duration || "",
    translator: r.translator || "",
    downloads: r.downloads || 0,
    image: r.poster_url || HERO_IMAGE,
    subtitleLink: r.subtitle_link || "",
    description: r.description || ""
  };
}

function mapCommentRow(r) {
  return { id: r.id, name: r.name, rating: r.rating, text: r.text, date: relativeDate(r.created_at) };
}

function relativeDate(iso) {
  const then = new Date(iso);
  const diffMin = Math.floor((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${faNumber(diffMin)} دقیقه پیش`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${faNumber(diffH)} ساعت پیش`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "دیروز";
  if (diffD < 7) return `${faNumber(diffD)} روز پیش`;
  if (diffD < 30) return `${faNumber(Math.floor(diffD / 7))} هفته پیش`;
  return then.toLocaleDateString("fa-IR");
}

async function loadTitles() {
  const { data, error } = await sb.from("titles").select("*").order("created_at", { ascending: false });
  if (error) { console.error("loadTitles:", error); return false; }
  mediaItems = (data || []).map(mapTitleRow);
  return true;
}

async function loadComments() {
  const { data, error } = await sb.from("comments")
    .select("*").eq("approved", true).order("created_at", { ascending: true });
  if (error) { console.error("loadComments:", error); return false; }
  state.comments = (data || []).map(mapCommentRow);
  return true;
}


const routeMeta = {
  movies: { type: "movie", title: "فیلم‌های کره‌ای", code: "۰۱ — فیلم", icon: "clapperboard",
    desc: "زیرنویس فارسی فیلم‌های سینمایی کره‌ای، از اکشن تا درام، با ترجمه‌ی روان و هماهنگ با زمان‌بندی اصلی." },
  series: { type: "series", title: "سریال‌های کره‌ای", code: "۰۲ — سریال", icon: "tv",
    desc: "آرشیو زیرنویس سریال‌های در حال پخش و کامل‌شده؛ هر قسمت به‌محض آماده‌شدن منتشر می‌شود." },
  shows: { type: "show", title: "برنامه‌های کره‌ای", code: "۰۳ — برنامه", icon: "mic-2",
    desc: "زیرنویس فارسی برنامه‌های سرگرمی، واقع‌نما، مسابقه‌ای و آشپزی محبوب کره‌ای." }
};

const HERO_IMAGE = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1600&q=80";

/* =====================================================
   In-memory state (no localStorage — kept in JS only)
===================================================== */

const state = {
  bookmarks: new Set(),
  comments: [],
  selectedStars: 5,
  loaded: false,
  catalog: {
    movies: { q: "", status: "all", sort: "latest" },
    series: { q: "", status: "all", sort: "latest" },
    shows: { q: "", status: "all", sort: "latest" }
  }
};

/* =====================================================
   DOM refs
===================================================== */

const $app = document.querySelector("#app");
const $header = document.querySelector("#site-header");
const $navMobile = document.querySelector("#nav-mobile");
const $menuToggle = document.querySelector("#menu-toggle");
const $themeToggle = document.querySelector("#theme-toggle");

const $searchOpen = document.querySelector("#search-open");
const $searchDialog = document.querySelector("#search-dialog");
const $searchInput = document.querySelector("#search-input");
const $searchResults = document.querySelector("#search-results");

const $detailsDialog = document.querySelector("#details-dialog");
const $detailsPanel = document.querySelector("#details-panel");

const $toast = document.querySelector("#toast");
const $toastMsg = document.querySelector("#toast-msg");

const $newsletterForm = document.querySelector("#newsletter-form");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =====================================================
   Helpers
===================================================== */

const faNumber = (n) => new Intl.NumberFormat("fa-IR").format(n);

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function icons() { if (window.lucide) window.lucide.createIcons(); }

function typeLabel(type) {
  return { movie: "فیلم", series: "سریال", show: "برنامه" }[type] || "";
}

function statusLabel(status) {
  return status === "completed" ? "کامل" : "در حال ترجمه";
}

function starIcons(count) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<i data-lucide="star" style="${i > count ? "opacity:.3" : ""}"></i>`;
  }
  return out;
}

function findItem(id) { return mediaItems.find((m) => m.id === Number(id)); }

let toastTimer = null;
function showToast(message) {
  $toastMsg.textContent = message;
  $toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $toast.classList.remove("show"), 3000);
}

function openOverlay(el) {
  el.hidden = false;
  document.body.classList.add("dialog-open");
}
function closeOverlay(el) {
  el.hidden = true;
  document.body.classList.remove("dialog-open");
}

/* =====================================================
   Card / tile / comment renderers
===================================================== */

function mediaCard(item) {
  const marked = state.bookmarks.has(item.id);
  return `
  <article class="card">
    <div class="card-poster" data-open="${item.id}" tabindex="0" role="button"
         aria-label="مشاهده‌ی جزئیات ${escapeHTML(item.title)}">
      <img src="${item.image}" alt="پوستر ${escapeHTML(item.title)}" loading="lazy">
      <div class="card-top">
        <span class="tag ${item.status}">${statusLabel(item.status)}</span>
        <button class="bookmark ${marked ? "active" : ""}" type="button" data-bookmark="${item.id}"
                aria-label="${marked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}">
          <i data-lucide="bookmark"></i>
        </button>
      </div>
      <div class="card-caption">
        <span class="card-timecode">${item.duration}</span>
        <span class="card-rating"><i data-lucide="star"></i>${item.rating}</span>
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHTML(item.title)}</h3>
      <p class="card-title-en">${escapeHTML(item.titleEn)}</p>
      <div class="card-meta">
        <span><i data-lucide="tag"></i>${escapeHTML(item.genre.split("،")[0])}</span>
        <span><i data-lucide="download"></i>${faNumber(item.downloads)}</span>
      </div>
    </div>
  </article>`;
}

function categoryTile(key) {
  const meta = routeMeta[key];
  const sample = mediaItems.find((m) => m.type === meta.type);
  const count = mediaItems.filter((m) => m.type === meta.type).length;
  return `
  <a href="#/${key}" class="tile">
    <img src="${sample ? sample.image : HERO_IMAGE}" alt="" aria-hidden="true">
    <div class="tile-body">
      <div class="tile-icon"><i data-lucide="${meta.icon}"></i></div>
      <h3>${meta.title}</h3>
      <p>${faNumber(count)} عنوان در آرشیو</p>
    </div>
  </a>`;
}

function commentCard(c) {
  return `
  <article class="comment-card">
    <div class="comment-top">
      <div class="avatar">${escapeHTML(c.name.charAt(0))}</div>
      <div class="comment-who"><strong>${escapeHTML(c.name)}</strong><span>${escapeHTML(c.date)}</span></div>
    </div>
    <div class="stars">${starIcons(c.rating)}</div>
    <p>${escapeHTML(c.text)}</p>
  </article>`;
}

/* =====================================================
   Views
===================================================== */

function viewHome() {
  const latest = [...mediaItems].sort((a, b) => b.id - a.id).slice(0, 8);

  return `
  <section class="hero">
    <div class="hero-bg"><img src="${HERO_IMAGE}" alt=""></div>
    <div class="wrap hero-inner">
      <span class="hero-eyebrow"><span class="dot"></span>آرشیو زنده‌ی زیرنویس فارسی</span>
      <div class="caption-bar">
        <h1>هر دیالوگ، <b>درست سر وقت.</b></h1>
      </div>
      <p class="hero-sub">Healer Sub زیرنویس فارسی فیلم، سریال و برنامه‌های کره‌ای را با ترجمه‌ی دقیق و هماهنگ با زمان‌بندی اصلی منتشر می‌کند.</p>
      <div class="hero-actions">
        <a href="#/series" class="btn btn-gold"><i data-lucide="download"></i>جدیدترین زیرنویس‌ها</a>
        <a href="#/comments" class="btn btn-outline"><i data-lucide="messages-square"></i>نظرات کاربران</a>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><strong>${faNumber(mediaItems.length)}+</strong><span>عنوان در آرشیو</span></div>
        <div class="hero-stat"><strong>${faNumber(120)}+</strong><span>مترجم همکار</span></div>
        <div class="hero-stat"><strong>${faNumber(180000)}+</strong><span>دانلود موفق</span></div>
        <div class="hero-stat"><strong>روزانه</strong><span>به‌روزرسانی آرشیو</span></div>
      </div>
    </div>
  </section>

  <section class="section section-line">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="cap">تازه‌ها</span>
          <h2 class="section-title">جدیدترین زیرنویس‌ها</h2>
          <p class="section-desc">آخرین قسمت‌ها و فیلم‌هایی که تیم Healer به‌تازگی ترجمه کرده.</p>
        </div>
        <a href="#/series" class="link-arrow">مشاهده‌ی همه<i data-lucide="arrow-left"></i></a>
      </div>
      <div class="grid">${latest.map(mediaCard).join("")}</div>
    </div>
  </section>

  <section class="section-tight">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="cap">دسته‌ها</span>
          <h2 class="section-title">دنبال چه چیزی می‌گردی؟</h2>
        </div>
      </div>
      <div class="tiles">${categoryTile("movies")}${categoryTile("series")}${categoryTile("shows")}</div>
    </div>
  </section>

  <section class="section section-line">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="cap">چرا Healer</span>
          <h2 class="section-title">فرق ما همین جزئیات کوچیکه</h2>
        </div>
      </div>
      <div class="features">
        <div class="feature"><div class="feature-icon"><i data-lucide="languages"></i></div><h3>ترجمه‌ی طبیعی</h3><p>دیالوگ‌ها را جوری برمی‌گردانیم که حس گفت‌وگوی روزمره داشته باشد، نه ترجمه‌ی خشک کلمه‌به‌کلمه.</p></div>
        <div class="feature"><div class="feature-icon"><i data-lucide="timer"></i></div><h3>هماهنگی دقیق زمان</h3><p>هر فایل با نسخه‌ی اصلی تطبیق داده می‌شود تا زیرنویس درست هم‌زمان با دیالوگ ظاهر شود.</p></div>
        <div class="feature"><div class="feature-icon"><i data-lucide="zap"></i></div><h3>انتشار سریع</h3><p>قسمت‌های در حال پخش معمولاً کمتر از یک روز پس از انتشار اصلی آماده می‌شوند.</p></div>
        <div class="feature"><div class="feature-icon"><i data-lucide="gift"></i></div><h3>آرشیو رایگان</h3><p>تمام زیرنویس‌ها بدون نیاز به عضویت یا هزینه در دسترس همه هستند.</p></div>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="cap">نظرات</span>
          <h2 class="section-title">حرف کاربران Healer</h2>
        </div>
        <a href="#/comments" class="link-arrow">ثبت نظر<i data-lucide="arrow-left"></i></a>
      </div>
      <div class="comments-preview-grid">${state.comments.slice(0, 3).map(commentCard).join("")}</div>
    </div>
  </section>`;
}

function filteredCatalog(routeKey) {
  const meta = routeMeta[routeKey];
  const f = state.catalog[routeKey];
  let items = mediaItems.filter((m) => m.type === meta.type);

  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    items = items.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      m.titleEn.toLowerCase().includes(q) ||
      m.genre.toLowerCase().includes(q)
    );
  }
  if (f.status !== "all") items = items.filter((m) => m.status === f.status);

  if (f.sort === "rating") items = [...items].sort((a, b) => b.rating - a.rating);
  else if (f.sort === "downloads") items = [...items].sort((a, b) => b.downloads - a.downloads);
  else items = [...items].sort((a, b) => b.id - a.id);

  return items;
}

function viewCatalog(routeKey) {
  const meta = routeMeta[routeKey];
  const f = state.catalog[routeKey];
  const items = filteredCatalog(routeKey);

  const grid = items.length
    ? `<div class="grid">${items.map(mediaCard).join("")}</div>`
    : `<div class="empty">
         <i data-lucide="search-x"></i>
         <h3>چیزی پیدا نشد</h3>
         <p>واژه‌ی دیگری امتحان کن یا فیلترها را پاک کن.</p>
       </div>`;

  return `
  <section class="page-hero">
    <div class="wrap page-hero-row">
      <div>
        <span class="cap">${meta.code}</span>
        <h1 class="page-title">${meta.title}</h1>
        <p class="page-desc">${meta.desc}</p>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="wrap">
      <div class="toolbar">
        <label class="field">
          <i data-lucide="search"></i>
          <input type="search" id="catalog-search" placeholder="جست‌وجو در ${meta.title}..." value="${escapeHTML(f.q)}">
        </label>
        <label class="field">
          <i data-lucide="filter"></i>
          <select id="catalog-status">
            <option value="all" ${f.status === "all" ? "selected" : ""}>همه‌ی وضعیت‌ها</option>
            <option value="completed" ${f.status === "completed" ? "selected" : ""}>کامل</option>
            <option value="ongoing" ${f.status === "ongoing" ? "selected" : ""}>در حال ترجمه</option>
          </select>
        </label>
        <label class="field">
          <i data-lucide="arrow-down-up"></i>
          <select id="catalog-sort">
            <option value="latest" ${f.sort === "latest" ? "selected" : ""}>جدیدترین</option>
            <option value="rating" ${f.sort === "rating" ? "selected" : ""}>بیشترین امتیاز</option>
            <option value="downloads" ${f.sort === "downloads" ? "selected" : ""}>پردانلودترین</option>
          </select>
        </label>
      </div>
      <p class="result-line">${faNumber(items.length)} عنوان یافت شد</p>
      ${grid}
    </div>
  </section>`;
}

function viewComments() {
  const list = [...state.comments].reverse();
  return `
  <section class="page-hero">
    <div class="wrap page-hero-row">
      <div>
        <span class="cap">نظرات</span>
        <h1 class="page-title">نظرات کاربران</h1>
        <p class="page-desc">تجربه‌ات از استفاده از Healer Sub را با بقیه‌ی کیدرامرها به اشتراک بگذار.</p>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="wrap comments-layout">
      <div class="comments-list">${list.map(commentCard).join("")}</div>

      <div class="comment-form-card">
        <h2>ثبت نظر جدید</h2>
        <p>نظر تو همین‌جا، تا پایان این نشست، ذخیره می‌شود.</p>
        <form id="comment-form" novalidate>
          <div class="field-group">
            <label for="c-name">نام</label>
            <input id="c-name" type="text" placeholder="مثلاً سارا" required>
          </div>
          <div class="field-group">
            <label>امتیاز</label>
            <div class="rating-pick" id="rating-pick">
              ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${n <= state.selectedStars ? "on" : ""}" aria-label="${n} ستاره"><i data-lucide="star"></i></button>`).join("")}
            </div>
          </div>
          <div class="field-group">
            <label for="c-text">نظر</label>
            <textarea id="c-text" placeholder="نظرت رو بنویس..." required></textarea>
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%">
            <i data-lucide="send"></i>ثبت نظر
          </button>
        </form>
      </div>
    </div>
  </section>`;
}

/* =====================================================
   Router
===================================================== */

function parseHash() {
  const raw = (window.location.hash || "#/home").replace(/^#\/?/, "");
  return raw || "home";
}

function viewLoading() {
  return `
  <section class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center">
    <div style="text-align:center;color:var(--muted)">
      <i data-lucide="loader-circle" class="spin" style="width:32px;height:32px"></i>
      <p style="margin-top:12px">در حال بارگذاری آرشیو...</p>
    </div>
  </section>`;
}

function viewLoadError() {
  return `
  <section class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center">
    <div style="text-align:center;color:var(--muted)">
      <i data-lucide="wifi-off" style="width:32px;height:32px"></i>
      <p style="margin-top:12px">اتصال به سرور برقرار نشد. لطفاً دوباره امتحان کن.</p>
      <button class="btn btn-outline" style="margin-top:16px" onclick="location.reload()">تلاش دوباره</button>
    </div>
  </section>`;
}

function render() {
  const route = parseHash();

  if (!state.loaded) { $app.innerHTML = viewLoading(); icons(); return; }
  if (state.loadFailed) { $app.innerHTML = viewLoadError(); icons(); return; }

  if (route === "home") $app.innerHTML = viewHome();
  else if (routeMeta[route]) $app.innerHTML = viewCatalog(route);
  else if (route === "comments") $app.innerHTML = viewComments();
  else $app.innerHTML = viewHome();

  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "instant" });
  icons();
  bindCatalogControls(route);
  bindCommentForm();
}

window.addEventListener("hashchange", render);

/* =====================================================
   Header scroll + mobile nav + theme
===================================================== */

window.addEventListener("scroll", () => {
  $header.classList.toggle("scrolled", window.scrollY > 12);
}, { passive: true });

$menuToggle.addEventListener("click", () => {
  const open = $navMobile.classList.toggle("open");
  $menuToggle.setAttribute("aria-expanded", String(open));
  $menuToggle.innerHTML = open ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
  icons();
});

document.querySelectorAll(".nav-mobile a").forEach((a) => {
  a.addEventListener("click", () => {
    $navMobile.classList.remove("open");
    $menuToggle.setAttribute("aria-expanded", "false");
    $menuToggle.innerHTML = '<i data-lucide="menu"></i>';
    icons();
  });
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $themeToggle.innerHTML = theme === "light" ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  icons();
}
applyTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

$themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
});

/* =====================================================
   Search dialog
===================================================== */

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    $searchResults.innerHTML = `<p class="search-empty">برای شروع، نام یک فیلم، سریال یا برنامه را بنویس.</p>`;
    return;
  }
  const matches = mediaItems.filter((m) =>
    m.title.toLowerCase().includes(q) || m.titleEn.toLowerCase().includes(q)
  ).slice(0, 8);

  if (!matches.length) {
    $searchResults.innerHTML = `<p class="search-empty">نتیجه‌ای برای «${escapeHTML(query)}» پیدا نشد.</p>`;
    return;
  }
  $searchResults.innerHTML = matches.map((m) => `
    <button type="button" class="result-row" data-open="${m.id}" data-close-search="1">
      <img src="${m.image}" alt="">
      <span><strong>${escapeHTML(m.title)}</strong><small>${escapeHTML(m.titleEn)}</small></span>
      <span>${typeLabel(m.type)}</span>
    </button>`).join("");
  icons();
}

$searchOpen.addEventListener("click", () => {
  openOverlay($searchDialog);
  $searchInput.value = "";
  renderSearchResults("");
  window.setTimeout(() => $searchInput.focus(), 30);
});

$searchDialog.addEventListener("click", (e) => { if (e.target === $searchDialog) closeOverlay($searchDialog); });
$searchInput.addEventListener("input", (e) => renderSearchResults(e.target.value));

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    $searchOpen.click();
  }
  if (e.key === "Escape") {
    if (!$searchDialog.hidden) closeOverlay($searchDialog);
    if (!$detailsDialog.hidden) closeOverlay($detailsDialog);
  }
});

document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
  btn.addEventListener("click", () => closeOverlay(btn.closest(".overlay")));
});

/* =====================================================
   Details dialog
===================================================== */

function openDetails(id) {
  const item = findItem(id);
  if (!item) return;

  const marked = state.bookmarks.has(item.id);

  $detailsPanel.innerHTML = `
    <button class="icon-btn details-close" type="button" data-close-dialog aria-label="بستن"><i data-lucide="x"></i></button>
    <div class="details-poster"><img src="${item.image}" alt="پوستر ${escapeHTML(item.title)}"></div>
    <div class="details-body">
      <h2 id="details-title">${escapeHTML(item.title)}</h2>
      <p class="details-en">${escapeHTML(item.titleEn)}</p>
      <div class="details-tags">
        ${item.tags.map((t) => `<span>${escapeHTML(t)}</span>`).join("")}
        <span>${item.year}</span>
        <span>${statusLabel(item.status)}</span>
      </div>
      <p class="details-desc">${escapeHTML(item.description)}</p>
      <ul class="details-info">
        <li><span>نوع اثر</span><span>${typeLabel(item.type)}</span></li>
        <li><span>وضعیت زیرنویس</span><span>${escapeHTML(item.episodeLabel)}</span></li>
        <li><span>مدت هر قسمت</span><span>${item.duration}</span></li>
        <li><span>مترجم</span><span>${escapeHTML(item.translator)}</span></li>
        <li><span>تعداد دانلود</span><span>${faNumber(item.downloads)}</span></li>
      </ul>
      <div class="details-actions">
        <button type="button" class="btn btn-gold" id="details-download"><i data-lucide="download"></i>دانلود زیرنویس</button>
        <button type="button" class="btn btn-outline" id="details-bookmark">
          <i data-lucide="bookmark"></i>${marked ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"}
        </button>
      </div>
    </div>`;

  icons();
  openOverlay($detailsDialog);

  $detailsPanel.querySelector("[data-close-dialog]").addEventListener("click", () => closeOverlay($detailsDialog));
  $detailsPanel.querySelector("#details-download").addEventListener("click", () => {
    if (item.subtitleLink) window.open(item.subtitleLink, "_blank", "noopener");
    showToast(`دانلود زیرنویس «${item.title}» شروع شد.`);
    sb.from("titles").update({ downloads: item.downloads + 1 }).eq("id", item.id).then(({ error }) => {
      if (!error) item.downloads += 1;
    });
  });
  $detailsPanel.querySelector("#details-bookmark").addEventListener("click", () => {
    toggleBookmark(item.id);
    closeOverlay($detailsDialog);
  });
}

$detailsDialog.addEventListener("click", (e) => { if (e.target === $detailsDialog) closeOverlay($detailsDialog); });

/* =====================================================
   Bookmarks
===================================================== */

function toggleBookmark(id) {
  if (state.bookmarks.has(id)) {
    state.bookmarks.delete(id);
    showToast("از علاقه‌مندی‌ها حذف شد.");
  } else {
    state.bookmarks.add(id);
    showToast("به علاقه‌مندی‌ها اضافه شد.");
  }
  render();
}

/* =====================================================
   Global click delegation (cards + search results)
===================================================== */

document.addEventListener("click", (e) => {
  const bookmarkBtn = e.target.closest("[data-bookmark]");
  if (bookmarkBtn) { toggleBookmark(Number(bookmarkBtn.dataset.bookmark)); return; }

  const opener = e.target.closest("[data-open]");
  if (opener) {
    if (opener.dataset.closeSearch) closeOverlay($searchDialog);
    openDetails(opener.dataset.open);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const poster = e.target.closest(".card-poster[data-open]");
  if (poster) { e.preventDefault(); openDetails(poster.dataset.open); }
});

/* =====================================================
   Catalog controls (re-bound after every render)
===================================================== */

function bindCatalogControls(route) {
  const search = document.querySelector("#catalog-search");
  const status = document.querySelector("#catalog-status");
  const sort = document.querySelector("#catalog-sort");
  if (!search || !routeMeta[route]) return;

  search.addEventListener("input", (e) => { state.catalog[route].q = e.target.value; renderCatalogInPlace(route); });
  status.addEventListener("change", (e) => { state.catalog[route].status = e.target.value; renderCatalogInPlace(route); });
  sort.addEventListener("change", (e) => { state.catalog[route].sort = e.target.value; renderCatalogInPlace(route); });
}

function renderCatalogInPlace(route) {
  const focused = document.activeElement && document.activeElement.id;
  $app.innerHTML = viewCatalog(route);
  icons();
  bindCatalogControls(route);
  if (focused === "catalog-search") {
    const el = document.querySelector("#catalog-search");
    if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
  }
}

/* =====================================================
   Comment form
===================================================== */

function bindCommentForm() {
  const form = document.querySelector("#comment-form");
  if (!form) return;

  document.querySelectorAll("#rating-pick [data-star]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedStars = Number(btn.dataset.star);
      document.querySelectorAll("#rating-pick [data-star]").forEach((b) => {
        b.classList.toggle("on", Number(b.dataset.star) <= state.selectedStars);
      });
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.querySelector("#c-name").value.trim();
    const text = document.querySelector("#c-text").value.trim();
    if (!name || !text) { showToast("لطفاً نام و متن نظر را کامل کن."); return; }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    const { error } = await sb.from("comments").insert({
      name, rating: state.selectedStars, text, approved: false
    });

    submitBtn.disabled = false;

    if (error) {
      console.error("submit comment:", error);
      showToast("ثبت نظر با خطا مواجه شد. دوباره امتحان کن.");
      return;
    }

    form.reset();
    state.selectedStars = 5;
    showToast("نظر تو ثبت شد و پس از تایید نمایش داده می‌شود.");
  });
}

/* =====================================================
   Newsletter form
===================================================== */

$newsletterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.querySelector("#newsletter-email");
  if (!input.value.trim()) return;
  showToast("عضویت در خبرنامه با موفقیت ثبت شد.");
  input.value = "";
});

/* =====================================================
   Init
===================================================== */

async function init() {
  render(); // نمایش وضعیت بارگذاری
  const [titlesOk] = await Promise.all([loadTitles(), loadComments()]);
  state.loaded = true;
  state.loadFailed = !titlesOk;
  render();
}

init();
