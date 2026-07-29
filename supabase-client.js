"use strict";

/* =====================================================
   اتصال مشترک به Supabase — این فایل قبل از app.js و admin.js
   لود می‌شود و متغیر سراسری `sb` را می‌سازد.
===================================================== */

const SUPABASE_URL = "https://adiozydhczsqrpjgcxcc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaW96eWRoY3pzcXJwamdjeGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzgzOTEsImV4cCI6MjEwMDkxNDM5MX0.fwgSLCtetkpjPJOWXV6rsmWoEESJg4ovzYkwyy2i14c";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
