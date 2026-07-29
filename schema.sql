-- ============ جدول عنوان‌ها (فیلم/سریال/برنامه) ============
create table if not exists public.titles (
  id bigint generated always as identity primary key,
  type text not null check (type in ('movie','series','show')),
  status text not null default 'ongoing' check (status in ('ongoing','completed')),
  title text not null,
  title_en text default '',
  genre text default '',
  year int,
  tags text[] default '{}',
  rating numeric(3,1) default 0,
  episode_label text default '',
  duration text default '',
  translator text default '',
  downloads int default 0,
  subtitle_link text not null,
  description text default '',
  poster_url text,
  poster_path text,
  created_at timestamptz default now()
);

-- ============ جدول نظرات ============
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  name text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  approved boolean not null default false,
  created_at timestamptz default now()
);

alter table public.titles enable row level security;
alter table public.comments enable row level security;

-- همه می‌توانند عنوان‌ها را بخوانند
create policy "titles_public_read" on public.titles
  for select using (true);

-- فقط کاربر لاگین‌شده (خودت در پنل ادمین) می‌تواند اضافه/ویرایش/حذف کند
create policy "titles_admin_insert" on public.titles
  for insert to authenticated with check (true);
create policy "titles_admin_update" on public.titles
  for update to authenticated using (true);
create policy "titles_admin_delete" on public.titles
  for delete to authenticated using (true);

-- بازدیدکننده‌ها فقط نظرات تایید‌شده را می‌بینند
create policy "comments_public_read_approved" on public.comments
  for select using (approved = true);

-- هر کسی می‌تواند نظر جدید (در انتظار تایید) بفرستد
create policy "comments_public_insert" on public.comments
  for insert to anon with check (approved = false);
create policy "comments_admin_insert" on public.comments
  for insert to authenticated with check (true);

-- خودت در پنل ادمین باید همه‌ی نظرات (حتی تاییدنشده) را ببینی
create policy "comments_admin_read_all" on public.comments
  for select to authenticated using (true);
create policy "comments_admin_update" on public.comments
  for update to authenticated using (true);
create policy "comments_admin_delete" on public.comments
  for delete to authenticated using (true);

-- ============ باکت ذخیره‌ی پوستر ============
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

create policy "posters_public_read" on storage.objects
  for select using (bucket_id = 'posters');
create policy "posters_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'posters');
create policy "posters_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'posters');
create policy "posters_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'posters');
