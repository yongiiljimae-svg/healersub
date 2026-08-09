"use strict";

/* =====================================================
   Data — loaded live from Supabase
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
    image: r.poster_url || HERO_IMAGE,
    subtitleLink: r.subtitle_link || "",
    episodes: r.episodes || [],
    description: r.description || "",
    downloads: r.downloads || 0,
    updatedAt: r.updated_at || r.created_at // خط جدید
  };
}

function mapCommentRow(r) {
  return { id: r.id, title_id: r.title_id, name: r.name, rating: r.rating, text: r.text, date: relativeDate(r.created_at), parent_id: r.parent_id, is_admin: r.is_admin };
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
  const { data, error } = await sb.from("titles").select("*").order("updated_at", { ascending: false });
  if (error) { console.error("loadTitles:", error); return false; }
  mediaItems = (data || []).map(mapTitleRow);
  return true;
}

async function loadComments() {
  const { data, error } = await sb.from("comments")
    .select("*").eq("approved", true).order("created_at", { ascending: false });
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

const state = {
  comments: [],
  loaded: false,
  lastHash: "",
  catalog: { movies: { q: "" }, series: { q: "" }, shows: { q: "" } }
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
function typeLabel(type) { return { movie: "فیلم", series: "سریال", show: "برنامه" }[type] || ""; }

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

function openOverlay(el) { el.hidden = false; document.body.classList.add("dialog-open"); }

function closeOverlay(el) { 
  el.hidden = true; 
  document.body.classList.remove("dialog-open"); 
  if (el === $detailsDialog) {
    history.replaceState(null, '', state.lastHash || '#/home');
  }
}

/* =====================================================
   Renderers
===================================================== */

function mediaCard(item) {
  return `
  <article class="card">
    <div class="card-poster" data-open="${item.id}" tabindex="0" role="button"
         aria-label="مشاهده‌ی جزئیات ${escapeHTML(item.title)}">
      <img src="${item.image}" alt="پوستر ${escapeHTML(item.title)}" loading="lazy">
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHTML(item.title)}</h3>
      <p class="card-title-en">${escapeHTML(item.titleEn)}</p>
      <div class="card-meta">
        <span><i data-lucide="tag"></i>${escapeHTML(item.genre.split("،")[0])}</span>
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

function commentCard(c, isChild = false) {
  const adminStyle = c.is_admin ? 'color: var(--gold);' : '';
  const cardStyle = isChild ? 'margin-top: 10px; padding: 10px 14px; background: rgba(255,255,255,0.02);' : 'margin-bottom: 12px; padding: 14px;';
  const avatarStyle = c.is_admin ? 'background: rgba(123, 212, 248, 0.15); color: var(--gold);' : '';
  
  return `
  <article class="comment-card ${c.is_admin ? 'admin-reply' : ''}" style="${cardStyle}">
    <div class="comment-top" style="margin-bottom: 6px;">
      <div class="avatar" style="width: 30px; height: 30px; font-size: 0.8rem; ${avatarStyle}">${escapeHTML(c.name.charAt(0))}</div>
      <div class="comment-who">
        <strong style="font-size: 0.9rem; ${adminStyle}">${escapeHTML(c.name)} ${c.is_admin ? '<span style="font-size:0.65rem; background:var(--gold); color:#000; padding:2px 6px; border-radius:4px; margin-right:4px;">مدیر</span>' : ''}</strong>
        <span style="font-size: 0.7rem;">${escapeHTML(c.date)}</span>
      </div>
    </div>
    ${!isChild ? `<div class="stars" style="margin-bottom: 4px;">${starIcons(c.rating)}</div>` : ''}
    <p style="font-size: 0.85rem; ${adminStyle}">${escapeHTML(c.text)}</p>
    ${!isChild ? `<button type="button" class="btn-reply" data-id="${c.id}" data-name="${escapeHTML(c.name)}"><i data-lucide="reply" style="width: 14px; height: 14px;"></i> پاسخ دادن</button>` : ''}
  </article>`;
}

/* =====================================================
   Views
===================================================== */

function viewHome() {
  const latest = [...mediaItems].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);

  return `
  <section class="section section-line">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="cap">تازه‌ها</span>
          <h2 class="section-title">جدیدترین زیرنویس‌ها</h2>
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
  </section>`;
}

function filteredCatalog(routeKey) {
  const meta = routeMeta[routeKey];
  const f = state.catalog[routeKey];
  let items = mediaItems.filter((m) => m.type === meta.type);
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    items = items.filter((m) =>
      m.title.toLowerCase().includes(q) || m.titleEn.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q)
    );
  }
  return [...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function viewCatalog(routeKey) {
  const meta = routeMeta[routeKey];
  const f = state.catalog[routeKey];
  const items = filteredCatalog(routeKey);

  const grid = items.length
    ? `<div class="grid">${items.map(mediaCard).join("")}</div>`
    : `<div class="empty"><i data-lucide="search-x"></i><h3>چیزی پیدا نشد</h3><p>واژه‌ی دیگری امتحان کن.</p></div>`;

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
        <label class="field" style="max-width: 400px; width: 100%;">
          <i data-lucide="search"></i>
          <input type="search" id="catalog-search" placeholder="جست‌وجو در ${meta.title}..." value="${escapeHTML(f.q)}">
        </label>
      </div>
      <p class="result-line">${faNumber(items.length)} عنوان یافت شد</p>
      ${grid}
    </div>
  </section>`;
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

/* =====================================================
   Router & Logic
===================================================== */

function bindCatalogControls(route) {
  const search = document.querySelector("#catalog-search");
  if (!search || !routeMeta[route]) return;
  search.addEventListener("input", (e) => { 
    state.catalog[route].q = e.target.value; 
    renderCatalogInPlace(route); 
  });
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

function render() {
  let route = (window.location.hash || "#/home").replace(/^#\/?/, "");
  
  let openTitleId = null;
  // سیستم تشخیص لینک مستقیم پروژه
  if (route.startsWith("title/")) {
    openTitleId = Number(route.split("/")[1]);
    route = (state.lastHash || "home").replace(/^#\/?/, "");
  }

  if (!state.loaded) { $app.innerHTML = viewLoading(); icons(); return; }
  if (state.loadFailed) { $app.innerHTML = viewLoadError(); icons(); return; }

  if (route === "home") $app.innerHTML = viewHome();
  else if (routeMeta[route]) $app.innerHTML = viewCatalog(route);
  else $app.innerHTML = viewHome();

  document.querySelectorAll("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  
  if (!openTitleId) {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "instant" });
  }
  
  icons();
  bindCatalogControls(route);

  // باز کردن خودکار پنجره اگر لینک حاوی آیدی باشد
  if (openTitleId) {
    setTimeout(() => openDetails(openTitleId), 50);
  }
}

window.addEventListener("hashchange", render);

/* =====================================================
   Details dialog & Comments
===================================================== */

function openDetails(id) {
  const item = findItem(id);
  if (!item) return;

  // ذخیره لینک قبلی برای وقتی که پنجره بسته می‌شود
  if (!window.location.hash.startsWith("#/title/")) {
    state.lastHash = window.location.hash || "#/home";
  }
  // تغییر لینک مرورگر به صورت بی‌صدا
  history.replaceState(null, '', '#/title/' + item.id);

  // --- بخش اول که جا افتاده بود: منطق نمایش تو در توی نظرات ---
  let replyParentId = null; 
  const projectComments = state.comments.filter((c) => c.title_id === item.id);
  const parentComments = projectComments.filter(c => !c.parent_id);
  
  let commentsHtml = '';
  if (parentComments.length) {
    commentsHtml = parentComments.map(p => {
      const children = projectComments.filter(c => c.parent_id === p.id).sort((a,b) => a.id - b.id);
      const childrenHtml = children.map(child => commentCard(child, true)).join('');
      return `<div>${commentCard(p, false)} <div class="replies">${childrenHtml}</div></div>`;
    }).join("");
  } else {
    commentsHtml = `<p style="color: var(--muted); font-size: 0.85rem; padding: 10px 0;">هنوز نظری ثبت نشده. اولین نفر باش!</p>`;
  }

  let downloadSection = "";
  if (item.type === 'movie') {
    downloadSection = `<button type="button" class="btn btn-gold" id="details-download-movie"><i data-lucide="download"></i>دانلود زیرنویس فیلم</button>`;
} else {
    const groupedEps = {};
    item.episodes.forEach(ep => {
      const sName = ep.season || "فصل ۱"; 
      if (!groupedEps[sName]) groupedEps[sName] = [];
      groupedEps[sName].push(ep);
    });

    const seasonsHtml = Object.keys(groupedEps).map(seasonName => {
      const epHtml = groupedEps[seasonName].map(ep => `
        <button type="button" class="btn btn-outline ep-download-btn" data-link="${ep.link}" style="justify-content: center; font-size: 0.85rem; padding: 10px;">
          <i data-lucide="download"></i>${escapeHTML(ep.label)}
        </button>
      `).join("");

      const isOpen = Object.keys(groupedEps).length === 1 ? "open" : "";
      
      return `
        <details class="season-accordion" style="margin-bottom: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 10px;" ${isOpen}>
          <summary style="padding: 14px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.95rem; user-select: none; color: var(--gold);">
            ${escapeHTML(seasonName)}
            <i data-lucide="chevron-down" class="season-chevron"></i>
          </summary>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 16px; border-top: 1px solid var(--border);">
            ${epHtml}
          </div>
        </details>
      `;
    }).join("");

    downloadSection = `
      <div style="width: 100%;">
        <h3 style="font-size: 1rem; margin-bottom: 14px; color: var(--gold);">لیست قسمت‌ها:</h3>
        ${seasonsHtml}
      </div>
    `;
  }

  $detailsPanel.innerHTML = `
    <button class="icon-btn details-close" type="button" data-close-dialog aria-label="بستن"><i data-lucide="x"></i></button>
    <div class="details-poster"><img src="${item.image}" alt="پوستر ${escapeHTML(item.title)}"></div>
    <div class="details-body">
      <h2 id="details-title">${escapeHTML(item.title)}</h2>
      <p class="details-en">${escapeHTML(item.titleEn)}</p>
      <div class="details-tags"><span>${item.year}</span></div>
      <p class="details-desc">${escapeHTML(item.description)}</p>
      <ul class="details-info">
        <li><span>نوع اثر</span><span>${typeLabel(item.type)}</span></li>
        <li><span>تعداد دانلود</span><span id="dl-count-${item.id}">${faNumber(item.downloads)}</span></li>
      </ul>
      <div class="details-actions" style="margin-bottom: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
        ${downloadSection}
        <button type="button" class="btn btn-outline" id="details-share"><i data-lucide="link"></i>کپی لینک</button>
      </div>

      <hr style="border-color: var(--border); margin: 30px 0 24px;">

      <h3 style="font-size: 1.05rem; margin-bottom: 16px;">نظرات کاربران</h3>
      <div class="project-comments-list" style="margin-bottom: 24px;">${commentsHtml}</div>

      <div class="comment-form-card" style="position: static; padding: 20px; background: rgba(0,0,0,0.2);">
        
        <!-- --- بخش دوم که جا افتاده بود: ساختار HTML فرم برای حالت پاسخ --- -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 0.95rem;" id="reply-title-indicator">ثبت نظر جدید</h4>
          <button type="button" id="cancel-reply-btn" style="display: none; background: none; border: none; color: #f28b8b; font-size: 0.8rem; cursor: pointer;">لغو پاسخ</button>
        </div>
        <!-- --------------------------------------------------------------- -->

        <p style="color: var(--muted); font-size: 0.8rem; margin: 0 0 16px;">نظرت پس از تایید مدیر برای این اثر نمایش داده می‌شود.</p>
        <form id="project-comment-form" novalidate>
          <div class="field-group" style="margin-bottom: 14px;">
            <input id="c-name" type="text" placeholder="نام شما" required style="width:100%; background:var(--bg); border:1px solid var(--border); padding:10px 14px; border-radius:10px; color:var(--text);">
          </div>
          <div class="field-group" style="margin-bottom: 14px; display:flex; align-items:center; gap:10px;">
            <label style="font-size: 0.85rem; color: var(--muted);">امتیاز:</label>
            <div class="rating-pick" id="modal-rating-pick">
              ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${n <= 5 ? "on" : ""}" aria-label="${n} ستاره"><i data-lucide="star"></i></button>`).join("")}
            </div>
          </div>
          <div class="field-group" style="margin-bottom: 14px;">
            <textarea id="c-text" placeholder="نظرت رو بنویس..." required rows="3" style="width:100%; background:var(--bg); border:1px solid var(--border); padding:10px 14px; border-radius:10px; color:var(--text); resize:vertical;"></textarea>
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%">
            <i data-lucide="send"></i>ثبت نظر
          </button>
        </form>
      </div>
    </div>`;

  icons();
  openOverlay($detailsDialog);

  $detailsPanel.querySelector("[data-close-dialog]").addEventListener("click", () => closeOverlay($detailsDialog));
  
  const shareBtn = $detailsPanel.querySelector("#details-share");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const url = window.location.origin + window.location.pathname + "#/title/" + item.id;
      navigator.clipboard.writeText(url).then(() => {
        showToast("لینک اختصاصی کپی شد.");
      }).catch(() => {
        showToast("مرورگر شما از کپی خودکار پشتیبانی نمی‌کند.");
      });
    });
  }

  const updateDownloadCount = async () => {
    const newDownloads = item.downloads + 1;
    const { error } = await sb.from("titles").update({ downloads: newDownloads }).eq("id", item.id);
    if (!error) {
      item.downloads = newDownloads;
      const countEl = $detailsPanel.querySelector(`#dl-count-${item.id}`);
      if (countEl) countEl.textContent = faNumber(newDownloads);
    }
  };

  if (item.type === 'movie') {
    const btn = $detailsPanel.querySelector("#details-download-movie");
    if (btn) {
      btn.addEventListener("click", () => {
        if (item.subtitleLink) window.open(item.subtitleLink, "_blank", "noopener");
        showToast(`دانلود زیرنویس «${item.title}» شروع شد.`);
        updateDownloadCount();
      });
    }
  } else {
    $detailsPanel.querySelectorAll(".ep-download-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        window.open(btn.dataset.link, "_blank", "noopener");
        showToast(`دانلود ${btn.textContent.trim()} شروع شد.`);
        updateDownloadCount();
      });
    });
  }

  let selectedStars = 5;
  const ratingBtns = $detailsPanel.querySelectorAll("#modal-rating-pick [data-star]");
  ratingBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedStars = Number(btn.dataset.star);
      ratingBtns.forEach((b) => b.classList.toggle("on", Number(b.dataset.star) <= selectedStars));
    });
  });

  $detailsPanel.querySelectorAll(".btn-reply").forEach(btn => {
    btn.addEventListener("click", () => {
      replyParentId = Number(btn.dataset.id);
      const titleIndicator = $detailsPanel.querySelector("#reply-title-indicator");
      const cancelBtn = $detailsPanel.querySelector("#cancel-reply-btn");
      if (titleIndicator) titleIndicator.textContent = `پاسخ به ${btn.dataset.name}`;
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
      $detailsPanel.querySelector("#c-text").focus();
    });
  });

  const cancelReplyBtn = $detailsPanel.querySelector("#cancel-reply-btn");
  if (cancelReplyBtn) {
     cancelReplyBtn.addEventListener("click", () => {
       replyParentId = null;
       $detailsPanel.querySelector("#reply-title-indicator").textContent = `ثبت نظر جدید`;
       cancelReplyBtn.style.display = 'none';
     });
  }

  const form = $detailsPanel.querySelector("#project-comment-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector("#c-name").value.trim();
    const text = form.querySelector("#c-text").value.trim();
    if (!name || !text) { showToast("لطفاً نام و متن نظر را کامل کن."); return; }
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    const { error } = await sb.from("comments").insert({ 
      title_id: item.id, 
      name: name, 
      rating: selectedStars, 
      text: text, 
      approved: false,
      parent_id: replyParentId, 
      is_admin: false 
    });

    submitBtn.disabled = false;
    if (error) { showToast("ثبت نظر با خطا مواجه شد. دوباره امتحان کن."); return; }

    form.reset();
    selectedStars = 5;
    ratingBtns.forEach((b) => b.classList.toggle("on", true));
    
    replyParentId = null;
    const titleIndicator = $detailsPanel.querySelector("#reply-title-indicator");
    if (titleIndicator) titleIndicator.textContent = `ثبت نظر جدید`;
    if (cancelReplyBtn) cancelReplyBtn.style.display = 'none';

    showToast("نظر تو ثبت شد و پس از تایید مدیریت نمایش داده می‌شود.");
  });
}

$detailsDialog.addEventListener("click", (e) => { if (e.target === $detailsDialog) closeOverlay($detailsDialog); });

/* =====================================================
   Global Helpers & Listeners
===================================================== */
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-open]");
  if (opener) {
    if (opener.dataset.closeSearch) closeOverlay($searchDialog);
    openDetails(opener.dataset.open);
  }
});

window.addEventListener("scroll", () => $header.classList.toggle("scrolled", window.scrollY > 12), { passive: true });
$themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
$menuToggle.addEventListener("click", () => {
  const open = $navMobile.classList.toggle("open");
  $menuToggle.innerHTML = open ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
  icons();
});
document.querySelectorAll(".nav-mobile a").forEach((a) => a.addEventListener("click", () => {
  $navMobile.classList.remove("open");
  $menuToggle.innerHTML = '<i data-lucide="menu"></i>';
  icons();
}));
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $themeToggle.innerHTML = theme === "light" ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  icons();
}
applyTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

$searchOpen.addEventListener("click", () => { openOverlay($searchDialog); $searchInput.value = ""; renderSearchResults(""); window.setTimeout(() => $searchInput.focus(), 30); });
$searchDialog.addEventListener("click", (e) => { if (e.target === $searchDialog) closeOverlay($searchDialog); });
$searchInput.addEventListener("input", (e) => renderSearchResults(e.target.value));
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) { e.preventDefault(); $searchOpen.click(); }
  if (e.key === "Escape") { if (!$searchDialog.hidden) closeOverlay($searchDialog); if (!$detailsDialog.hidden) closeOverlay($detailsDialog); }
});
document.querySelectorAll("[data-close-dialog]").forEach((btn) => btn.addEventListener("click", () => closeOverlay(btn.closest(".overlay"))));

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) { $searchResults.innerHTML = `<p class="search-empty">برای شروع، کلمه‌ای بنویس.</p>`; return; }
  const matches = mediaItems.filter((m) => m.title.toLowerCase().includes(q) || m.titleEn.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { $searchResults.innerHTML = `<p class="search-empty">نتیجه‌ای پیدا نشد.</p>`; return; }
  $searchResults.innerHTML = matches.map((m) => `<button type="button" class="result-row" data-open="${m.id}" data-close-search="1"><img src="${m.image}" alt=""><span><strong>${escapeHTML(m.title)}</strong><small>${escapeHTML(m.titleEn)}</small></span><span>${typeLabel(m.type)}</span></button>`).join("");
  icons();
}

async function trackVisitors() {
  try {
    if (!sessionStorage.getItem('visited')) { await sb.from("visits").insert({}); sessionStorage.setItem('visited', 'true'); }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayRes, monthRes] = await Promise.all([
      sb.from("visits").select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      sb.from("visits").select('*', { count: 'exact', head: true }).gte('created_at', firstOfMonth.toISOString())
    ]);
    const todayEl = document.getElementById('stat-today');
    const monthEl = document.getElementById('stat-month');
    if(todayEl) todayEl.textContent = faNumber(todayRes.count || 0);
    if(monthEl) monthEl.textContent = faNumber(monthRes.count || 0);
  } catch (err) { console.error("Visits error:", err); }
}

async function init() {
  render();
  const [titlesOk] = await Promise.all([loadTitles(), loadComments()]);
  state.loaded = true;
  state.loadFailed = !titlesOk;
  render();
  trackVisitors();
}

init();
