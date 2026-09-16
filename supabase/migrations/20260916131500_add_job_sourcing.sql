alter table public.jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_kind text not null default 'sample',
  add column if not exists source_name text not null default 'JobCards sample',
  add column if not exists description text not null default '',
  add column if not exists published_at timestamptz;

create unique index if not exists jobs_user_source_url_uidx on public.jobs(user_id, source_url)
where user_id is not null and source_url is not null;
create index if not exists jobs_user_created_idx on public.jobs(user_id, created_at desc);

drop policy if exists "jobs_select_authenticated" on public.jobs;
create policy "jobs_select_visible" on public.jobs for select to authenticated
using (user_id is null or user_id = (select auth.uid()));
create policy "jobs_insert_own" on public.jobs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "jobs_update_own" on public.jobs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant insert, update on public.jobs to authenticated;
grant usage, select on sequence public.jobs_id_seq to authenticated;

create table public.scan_sources (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('company_page','job_url')),
  name text not null check (char_length(name) between 1 and 120),
  url text not null check (url ~ '^https://'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, url)
);
create index scan_sources_user_id_idx on public.scan_sources(user_id);
alter table public.scan_sources enable row level security;
create policy "scan_sources_select_own" on public.scan_sources for select to authenticated using ((select auth.uid())=user_id);
create policy "scan_sources_insert_own" on public.scan_sources for insert to authenticated with check ((select auth.uid())=user_id);
create policy "scan_sources_update_own" on public.scan_sources for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "scan_sources_delete_own" on public.scan_sources for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.scan_sources to authenticated;
grant usage,select on sequence public.scan_sources_id_seq to authenticated;

create table public.scan_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('running','completed','failed')),
  sources_checked integer not null default 0,
  jobs_found integer not null default 0,
  jobs_added integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index scan_runs_user_started_idx on public.scan_runs(user_id, started_at desc);
alter table public.scan_runs enable row level security;
create policy "scan_runs_select_own" on public.scan_runs for select to authenticated using ((select auth.uid())=user_id);
create policy "scan_runs_insert_own" on public.scan_runs for insert to authenticated with check ((select auth.uid())=user_id);
create policy "scan_runs_update_own" on public.scan_runs for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.scan_runs to authenticated;
grant usage,select on sequence public.scan_runs_id_seq to authenticated;
