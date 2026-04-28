-- 1) 분석 내역 테이블
create table if not exists public.messenger_analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now(),
  image_path text,
  analysis_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_messenger_analysis_history_user_saved_at
  on public.messenger_analysis_history (user_id, saved_at desc);

alter table public.messenger_analysis_history enable row level security;

-- 2) RLS 정책 (본인 데이터만)
drop policy if exists "messenger_analysis_select_own" on public.messenger_analysis_history;
create policy "messenger_analysis_select_own"
  on public.messenger_analysis_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "messenger_analysis_insert_own" on public.messenger_analysis_history;
create policy "messenger_analysis_insert_own"
  on public.messenger_analysis_history
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "messenger_analysis_delete_own" on public.messenger_analysis_history;
create policy "messenger_analysis_delete_own"
  on public.messenger_analysis_history
  for delete
  using (auth.uid() = user_id);

-- 3) 스토리지 버킷 생성
insert into storage.buckets (id, name, public)
values ('messenger-analysis-images', 'messenger-analysis-images', false)
on conflict (id) do nothing;

-- 4) 스토리지 RLS 정책 (본인 폴더만: user_id/...)
drop policy if exists "messenger_analysis_storage_select_own" on storage.objects;
create policy "messenger_analysis_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'messenger-analysis-images'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "messenger_analysis_storage_insert_own" on storage.objects;
create policy "messenger_analysis_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'messenger-analysis-images'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "messenger_analysis_storage_delete_own" on storage.objects;
create policy "messenger_analysis_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'messenger-analysis-images'
    and auth.uid()::text = split_part(name, '/', 1)
  );
