"use strict";

/* =====================================================
   Admin panel — auth + CRUD, talks directly to Supabase.
   Security is enforced server-side by RLS (supabase-schema.sql):
   anonymous users can never write, no matter what this file does.
===================================================== */

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
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard(session.user.email);
    await loadAll();
  } else {
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

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $loginError.textContent = "ایمیل یا رمز عبور اشتباه است.";
    $loginError.hidden = false;
    return;
  }
  showDashboard(data.user.email);
  await loadAll();
});

document.querySelector("#logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});

/* =====================================================
   Tabs
===================================================== */

document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b === btn));
    const tab = btn.dataset.tab;
    document.querySelector("#tab-titles").hidden = tab !== "titles";
    document.querySelector("#tab-comments").hidden = tab !== "comments";
  });
});

/* =====================================================
   Load data
===================================================== */

async function loadAll() {
  await Promise.all([loadTitles(), loadComments()]);
  renderTitlesList();
  renderCommentsList();
}

async function loadTitles() {
  const { data, error } = await sb.from("titles").select("*").order("created_at", { ascending: false });
  if (error) { showToast("خطا در بارگذاری پروژه‌ها."); console.error(error); return; }
  titles = data || [];
}

async function loadComments() {
  const { data, error } = await sb.from("comments").select("*").order("created_at", { ascending: false });
  if (error) { showToast("خطا در بارگذاری نظرات."); console.error(error); return; }
  comments = data || [];
}

/* =====================================================
   Titles: render list
===================================================== */

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
   Titles: add / edit form
===================================================== */

function fieldRefs() {
  return {
    type: document.querySelector("#t-type"),
    status: document.querySelector("#t-status"),
    title: document.querySelector("#t-title"),
    titleEn: document.querySelector("#t-title-en"),
    genre: document.querySelector("#t-genre"),
    year: document.querySelector("#t-year"),
    tags: document.querySelector("#t-tags"),
    rating: document.querySelector("#t-rating"),
    episode: document.querySelector("#t-episode"),
    duration: document.querySelector("#t-duration"),
    translator: document.querySelector("#t-translator"),
    downloads: document.querySelector("#t-downloads"),
    subtitleLink: document.querySelector("#t-subtitle-link"),
    description: document.querySelector("#t-description")
  };
}

function startEdit(id) {
  const t = titles.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  const f = fieldRefs();
  f.type.value = t.type;
  f.status.value = t.status;
  f.title.value = t.title || "";
  f.titleEn.value = t.title_en || "";
  f.genre.value = t.genre || "";
  f.year.value = t.year || "";
  f.tags.value = (t.tags || []).join("، ");
  f.rating.value = t.rating || "";
  f.episode.value = t.episode_label || "";
  f.duration.value = t.duration || "";
  f.translator.value = t.translator || "";
  f.downloads.value = t.downloads || 0;
  f.subtitleLink.value = t.subtitle_link || "";
  f.description.value = t.description || "";

  if (t.poster_url) {
    $posterPreviewImg.src = t.poster_url;
    $posterPreview.hidden = false;
  } else {
    $posterPreview.hidden = true;
  }

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
  document.querySelector("#t-downloads").value = 0;
  $formHeading.textContent = "افزودن پروژه جدید";
  $submitBtn.innerHTML = '<i data-lucide="plus"></i>افزودن پروژه';
  $resetFormBtn.hidden = true;
  icons();
}

$resetFormBtn.addEventListener("click", resetForm);

$posterInput.addEventListener("change", () => {
  const file = $posterInput.files[0];
  if (!file) return;
  $posterPreviewImg.src = URL.createObjectURL(file);
  $posterPreview.hidden = false;
});

async function uploadPoster(file) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("posters").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("posters").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

$titleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $titleFormError.hidden = true;
  const f = fieldRefs();

  if (!f.title.value.trim() || !f.subtitleLink.value.trim()) {
    $titleFormError.textContent = "عنوان و لینک زیرنویس اجباری هستند.";
    $titleFormError.hidden = false;
    return;
  }

  $submitBtn.disabled = true;

  const payload = {
    type: f.type.value,
    status: f.status.value,
    title: f.title.value.trim(),
    title_en: f.titleEn.value.trim(),
    genre: f.genre.value.trim(),
    year: f.year.value ? Number(f.year.value) : null,
    tags: f.tags.value.trim() ? f.tags.value.split("،").map((s) => s.trim()).filter(Boolean) : [],
    rating: f.rating.value ? Number(f.rating.value) : 0,
    episode_label: f.episode.value.trim(),
    duration: f.duration.value.trim(),
    translator: f.translator.value.trim(),
    downloads: f.downloads.value ? Number(f.downloads.value) : 0,
    subtitle_link: f.subtitleLink.value.trim(),
    description: f.description.value.trim()
  };

  try {
    const file = $posterInput.files[0];
    if (file) {
      const { url, path } = await uploadPoster(file);
      payload.poster_url = url;
      payload.poster_path = path;
    }

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
  if (error) { showToast("حذف با خطا مواجه شد."); console.error(error); return; }

  if (t.poster_path) {
    sb.storage.from("posters").remove([t.poster_path]).catch(() => {});
  }
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

  $commentsList.innerHTML = comments.map((c) => `
    <div class="admin-row" style="align-items:flex-start">
      <div class="admin-row-main">
        <strong>${escapeHTML(c.name)} <span class="admin-status-pill ${c.approved ? "approved" : "pending"}">${c.approved ? "تاییدشده" : "در انتظار"}</span></strong>
        <p class="admin-comment-text">${escapeHTML(c.text)}</p>
      </div>
      <div class="admin-row-actions">
        ${c.approved ? "" : `<button type="button" data-approve="${c.id}" aria-label="تایید"><i data-lucide="check"></i></button>`}
        <button type="button" class="danger" data-delete-comment="${c.id}" aria-label="حذف"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join("");
  icons();

  $commentsList.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => approveComment(Number(b.dataset.approve))));
  $commentsList.querySelectorAll("[data-delete-comment]").forEach((b) => b.addEventListener("click", () => deleteComment(Number(b.dataset.deleteComment))));
}

async function approveComment(id) {
  const { error } = await sb.from("comments").update({ approved: true }).eq("id", id);
  if (error) { showToast("تایید با خطا مواجه شد."); return; }
  showToast("نظر تایید شد.");
  await loadComments();
  renderCommentsList();
}

async function deleteComment(id) {
  if (!confirm("این نظر حذف بشه؟")) return;
  const { error } = await sb.from("comments").delete().eq("id", id);
  if (error) { showToast("حذف با خطا مواجه شد."); return; }
  showToast("نظر حذف شد.");
  await loadComments();
  renderCommentsList();
}

/* =====================================================
   Init
===================================================== */

checkSession();
