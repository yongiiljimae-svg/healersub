"use strict";

let titles = [];
let comments = [];
let editingId = null;

const $loginSection = document.querySelector("#admin-login");
const $dashboard = document.querySelector("#admin-dashboard");
const $loginForm = document.querySelector("#login-form");
const $loginError = document.querySelector("#login-error");
const $whoami = document.querySelector("#admin-whoami");

const $titleForm = document.querySelector("#title-form");
const $titleFormError = document.querySelector("#title-form-error");
const $titlesList = document.querySelector("#titles-list");
const $commentsList = document.querySelector("#comments-list");
const $pendingBadge = document.querySelector("#pending-badge");
const $formHeading = document.querySelector("#titles-form-heading");
const $submitBtn = document.querySelector("#title-submit-btn");
const $resetFormBtn = document.querySelector("#reset-form-btn");

const $posterInput = document.querySelector("#t-poster");
const $posterPreview = document.querySelector("#poster-preview");
const $posterPreviewImg = document.querySelector("#poster-preview-img");

const $toast = document.querySelector("#toast");
const $toastMsg = document.querySelector("#toast-msg");

function icons() { if (window.lucide) window.lucide.createIcons(); }

let toastTimer = null;
function showToast(msg) {
  $toastMsg.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove("show"), 3000);
}

function escapeHTML(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const typeLabel = (t) => ({ movie: "فیلم", series: "سریال", show: "برنامه" }[t] || t);

/* =====================================================
   Auth
===================================================== */

async function checkSession() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session) {
      showDashboard(session.user.email);
      await loadAll();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("checkSession error:", err);
    $loginError.textContent = "اتصال به سرور برقرار نشد. کلید API یا شبکه را بررسی کن.";
    $loginError.hidden = false;
    showLogin();
  }
}

function showLogin() {
  $loginSection.hidden = false;
  $dashboard.hidden = true;
}

function showDashboard(email) {
  $loginSection.hidden = true;
  $dashboard.hidden = false;
  $whoami.textContent = email || "";
}

$loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $loginError.hidden = true;
  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message && error.message.toLowerCase().includes("email not confirmed")) {
        $loginError.textContent = "ایمیل هنوز تأیید نشده است. لطفاً inbox خود را چک کنید.";
      } else {
        $loginError.textContent = "ایمیل یا رمز عبور اشتباه است.";
      }
      $loginError.hidden = false;
      return;
    }
    showDashboard(data.user.email);
    await loadAll();
  } catch (err) {
    console.error("Login error:", err);
    $loginError.textContent = "خطا در اتصال به Supabase.";
    $loginError.hidden = false;
  }
});

document.querySelector("#logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});

/* =====================================================
   Tabs & Data
===================================================== */

document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b === btn));
    const tab = btn.dataset.tab;
    document.querySelector("#tab-titles").hidden = tab !== "titles";
    document.querySelector("#tab-comments").hidden = tab !== "comments";
  });
});

async function loadAll() {
  await Promise.all([loadTitles(), loadComments()]);
  renderTitlesList();
  renderCommentsList();
}

async function loadTitles() {
  const { data, error } = await sb.from("titles").select("*").order("created_at", { ascending: false });
  if (error) { showToast("خطا در بارگذاری پروژه‌ها."); return; }
  titles = data || [];
}

async function loadComments() {
  const { data, error } = await sb.from("comments").select("*").order("created_at", { ascending: false });
  if (error) { showToast("خطا در بارگذاری نظرات."); return; }
  comments = data || [];
}

function renderTitlesList() {
  if (!titles.length) {
    $titlesList.innerHTML = `<p class="admin-empty">هنوز پروژه‌ای اضافه نشده.</p>`;
    return;
  }
  $titlesList.innerHTML = titles.map((t) => `
    <div class="admin-row">
      <img src="${t.poster_url || ""}" alt="">
      <div class="admin-row-main">
        <strong>${escapeHTML(t.title)}</strong>
        <small>${typeLabel(t.type)} · ${t.year || "—"} · ${escapeHTML(t.genre || "")}</small>
      </div>
      <div class="admin-row-actions">
        <button type="button" data-edit="${t.id}" aria-label="ویرایش"><i data-lucide="pencil"></i></button>
        <button type="button" class="danger" data-delete="${t.id}" aria-label="حذف"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join("");
  icons();

  $titlesList.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => startEdit(Number(b.dataset.edit))));
  $titlesList.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => deleteTitle(Number(b.dataset.delete))));
}

/* =====================================================
   Titles: Episode Logic & Form
===================================================== */

const $typeSelect = document.querySelector("#t-type");
const $linkMovieWrap = document.querySelector("#link-movie-wrap");
const $linkSeriesWrap = document.querySelector("#link-series-wrap");
const $episodesContainer = document.querySelector("#episodes-container");
const $addEpBtn = document.querySelector("#add-ep-btn");

$typeSelect.addEventListener("change", (e) => {
  const isSeries = e.target.value !== "movie";
  $linkMovieWrap.hidden = isSeries;
  $linkSeriesWrap.hidden = !isSeries;
});

function createEpRow(label = "", link = "") {
  const row = document.createElement("div");
  row.className = "ep-row";
  row.style.display = "flex";
  row.style.gap = "8px";
  row.innerHTML = `
    <button type="button" class="btn btn-outline btn-sm move-up" style="border-radius: 8px; padding: 0 8px;" title="انتقال به بالا"><i data-lucide="chevron-up"></i></button>
    <button type="button" class="btn btn-outline btn-sm move-down" style="border-radius: 8px; padding: 0 8px;" title="انتقال به پایین"><i data-lucide="chevron-down"></i></button>
    <input type="text" placeholder="مثلاً: قسمت 1" value="${escapeHTML(label)}" class="ep-label" required style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; color: var(--text);">
    <input type="url" placeholder="لینک زیرنویس" value="${link}" class="ep-link" required style="flex: 2; background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; color: var(--text);">
    <button type="button" class="btn danger btn-sm del-ep" style="border-radius: 8px; padding: 0 12px;"><i data-lucide="trash"></i></button>
  `;
  
  row.querySelector(".del-ep").onclick = () => row.remove();
  
  // منطق دکمه بالا بردن
  row.querySelector(".move-up").onclick = () => {
    const prev = row.previousElementSibling;
    if (prev) row.parentNode.insertBefore(row, prev);
  };
  
  // منطق دکمه پایین آوردن
  row.querySelector(".move-down").onclick = () => {
    const next = row.nextElementSibling;
    if (next) row.parentNode.insertBefore(next, row);
  };

  return row;
}

$addEpBtn.addEventListener("click", () => {
  $episodesContainer.appendChild(createEpRow());
  icons();
});

function fieldRefs() {
  return {
    type: document.querySelector("#t-type"),
    title: document.querySelector("#t-title"),
    titleEn: document.querySelector("#t-title-en"),
    genre: document.querySelector("#t-genre"),
    year: document.querySelector("#t-year"),
    subtitleLink: document.querySelector("#t-subtitle-link"),
    description: document.querySelector("#t-description"),
    poster: document.querySelector("#t-poster")
  };
}

function startEdit(id) {
  const t = titles.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  const f = fieldRefs();
  
  f.type.value = t.type;
  f.title.value = t.title || "";
  f.titleEn.value = t.title_en || "";
  f.genre.value = t.genre || "";
  f.year.value = t.year || "";
  f.subtitleLink.value = t.subtitle_link || "";
  f.description.value = t.description || "";

  if (t.poster_url) {
    f.poster.value = t.poster_url;
    $posterPreviewImg.src = t.poster_url;
    $posterPreview.hidden = false;
  } else {
    f.poster.value = "";
    $posterPreview.hidden = true;
  }

  // Load episodes
  $episodesContainer.innerHTML = "";
  if (t.type !== "movie" && t.episodes && t.episodes.length) {
    t.episodes.forEach(ep => $episodesContainer.appendChild(createEpRow(ep.label, ep.link)));
  } else if (t.type !== "movie") {
    $episodesContainer.appendChild(createEpRow());
  }

  $typeSelect.dispatchEvent(new Event("change"));

  $formHeading.textContent = `ویرایش «${t.title}»`;
  $submitBtn.innerHTML = '<i data-lucide="save"></i>ذخیره تغییرات';
  $resetFormBtn.hidden = false;
  icons();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  $titleForm.reset();
  $posterPreview.hidden = true;
  $episodesContainer.innerHTML = "";
  $typeSelect.dispatchEvent(new Event("change"));
  $formHeading.textContent = "افزودن پروژه جدید";
  $submitBtn.innerHTML = '<i data-lucide="plus"></i>افزودن پروژه';
  $resetFormBtn.hidden = true;
  icons();
}

$resetFormBtn.addEventListener("click", resetForm);

$posterInput.addEventListener("input", () => {
  const url = $posterInput.value.trim();
  if (url) {
    $posterPreviewImg.src = url;
    $posterPreview.hidden = false;
  } else {
    $posterPreview.hidden = true;
  }
});

$titleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $titleFormError.hidden = true;
  const f = fieldRefs();

  if (!f.title.value.trim()) {
    $titleFormError.textContent = "عنوان اجباری است.";
    $titleFormError.hidden = false; return;
  }

const payload = {
    type: f.type.value,
    status: "ongoing", 
    title: f.title.value.trim(),
    title_en: f.titleEn.value.trim(),
    genre: f.genre.value.trim(),
    year: f.year.value ? Number(f.year.value) : null,
    description: f.description.value.trim(),
    poster_url: f.poster.value.trim() || null,
    updated_at: new Date().toISOString() // ثبت زمان دقیق در هنگام ویرایش یا افزودن
  };

  if (f.type.value === "movie") {
    if (!f.subtitleLink.value.trim()) {
      $titleFormError.textContent = "لینک زیرنویس فیلم را وارد کنید.";
      $titleFormError.hidden = false; return;
    }
    payload.subtitle_link = f.subtitleLink.value.trim();
    payload.episodes = [];
  } else {
    payload.subtitle_link = "#"; // برای رفع ارور required دیتابیس
    let eps = [];
    document.querySelectorAll(".ep-row").forEach(r => {
       const lbl = r.querySelector(".ep-label").value.trim();
       const lnk = r.querySelector(".ep-link").value.trim();
       if(lbl && lnk) eps.push({ label: lbl, link: lnk });
    });
    if(eps.length === 0) {
      $titleFormError.textContent = "حداقل یک قسمت برای سریال وارد کنید.";
      $titleFormError.hidden = false; return;
    }
    payload.episodes = eps;
  }

  $submitBtn.disabled = true;

  try {
    let error;
    if (editingId) {
      ({ error } = await sb.from("titles").update(payload).eq("id", editingId));
    } else {
      ({ error } = await sb.from("titles").insert(payload));
    }
    if (error) throw error;

    showToast(editingId ? "پروژه ویرایش شد." : "پروژه اضافه شد.");
    resetForm();
    await loadTitles();
    renderTitlesList();
  } catch (err) {
    console.error(err);
    $titleFormError.textContent = "ذخیره‌سازی با خطا مواجه شد. دوباره امتحان کن.";
    $titleFormError.hidden = false;
  } finally {
    $submitBtn.disabled = false;
  }
});

async function deleteTitle(id) {
  const t = titles.find((x) => x.id === id);
  if (!t) return;
  if (!confirm(`«${t.title}» حذف بشه؟ این کار برگشت‌ناپذیره.`)) return;
  const { error } = await sb.from("titles").delete().eq("id", id);
  if (error) { showToast("حذف با خطا مواجه شد."); return; }
  showToast("پروژه حذف شد.");
  await loadTitles();
  renderTitlesList();
}

/* =====================================================
   Comments moderation
===================================================== */

function renderCommentsList() {
  const pendingCount = comments.filter((c) => !c.approved).length;
  $pendingBadge.hidden = pendingCount === 0;
  $pendingBadge.textContent = pendingCount;

  if (!comments.length) {
    $commentsList.innerHTML = `<p class="admin-empty">هنوز نظری ثبت نشده.</p>`;
    return;
  }

  $commentsList.innerHTML = comments.map((c) => {
    // برچسب "پاسخ" اگر پیام فرزند باشد
    const parentLabel = c.parent_id ? `<span style="font-size:0.7rem; color:#d4af37; border:1px solid #d4af37; border-radius:4px; padding:1px 4px; margin-right:5px;">پاسخ</span>` : '';
    // استایل آبی اگر پیام مدیر باشد
    const adminStyle = c.is_admin ? 'color: #7bd4f8;' : '';
    
    return `
    <div class="admin-row" style="align-items:flex-start">
      <div class="admin-row-main">
        <strong>${escapeHTML(c.name)} ${c.is_admin ? '(شما)' : ''} ${parentLabel} <span class="admin-status-pill ${c.approved ? "approved" : "pending"}">${c.approved ? "تاییدشده" : "در انتظار"}</span></strong>
        <p class="admin-comment-text" style="${adminStyle}">${escapeHTML(c.text)}</p>
        
        <!-- کادر مخفی پاسخ دادن -->
        <div id="reply-box-${c.id}" style="display:none; margin-top:10px;">
           <textarea id="reply-text-${c.id}" placeholder="متن پاسخ شما به عنوان مدیر..." style="width:100%; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text); font-family:inherit; resize:vertical;"></textarea>
           <button type="button" class="btn btn-gold btn-sm" data-send-reply="${c.id}" data-title-id="${c.title_id}" style="margin-top:6px;">ارسال پاسخ</button>
        </div>
      </div>
      <div class="admin-row-actions">
        ${!c.parent_id ? `<button type="button" data-toggle-reply="${c.id}" aria-label="پاسخ دادن"><i data-lucide="reply"></i></button>` : ''}
        ${c.approved ? "" : `<button type="button" data-approve="${c.id}" aria-label="تایید"><i data-lucide="check"></i></button>`}
        <button type="button" class="danger" data-delete-comment="${c.id}" aria-label="حذف"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`
  }).join("");
  
  icons();

  // منطق باز شدن کادر پاسخ
  $commentsList.querySelectorAll("[data-toggle-reply]").forEach(b => {
    b.addEventListener("click", () => {
      const box = document.getElementById(`reply-box-${b.dataset.toggleReply}`);
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
  });

  // منطق ارسال پاسخ مدیر
  $commentsList.querySelectorAll("[data-send-reply]").forEach(b => {
    b.addEventListener("click", async () => {
      const parentId = b.dataset.sendReply;
      const titleId = b.dataset.titleId;
      const textInput = document.getElementById(`reply-text-${parentId}`);
      const text = textInput.value.trim();
      if(!text) return;
      
      b.disabled = true;
      const { error } = await sb.from("comments").insert({
        title_id: titleId, 
        name: "هیلر", 
        rating: 5, 
        text: text,
        approved: true,       // نظرات مدیر مستقیماً تایید می‌شود
        parent_id: parentId,  // مشخص می‌کند که این یک پاسخ است
        is_admin: true        // مدیر بودن را تایید می‌کند تا در سایت آبی شود
      });
      
      if(error) { showToast("خطا در ارسال پاسخ."); b.disabled = false; return; }
      showToast("پاسخ شما با موفقیت ثبت شد.");
      await loadComments();
      renderCommentsList();
    });
  });

  $commentsList.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => approveComment(Number(b.dataset.approve))));
  $commentsList.querySelectorAll("[data-delete-comment]").forEach((b) => b.addEventListener("click", () => deleteComment(Number(b.dataset.deleteComment))));
}

async function approveComment(id) {
  await sb.from("comments").update({ approved: true }).eq("id", id);
  showToast("نظر تایید شد.");
  await loadComments();
  renderCommentsList();
}

async function deleteComment(id) {
  if (!confirm("این نظر حذف بشه؟")) return;
  await sb.from("comments").delete().eq("id", id);
  showToast("نظر حذف شد.");
  await loadComments();
  renderCommentsList();
}

checkSession();
