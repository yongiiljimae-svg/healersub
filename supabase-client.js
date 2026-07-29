"use strict";

/* =====================================================
   اتصال مشترک به Supabase — این فایل قبل از app.js و admin.js
   لود می‌شود و متغیر سراسری `sb` را می‌سازد.
===================================================== */

const SUPABASE_URL = "https://adiozydhczsqrpjgcxcc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y6_lpA_SiWXioaHTSib1mw_sQuIZHok";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
