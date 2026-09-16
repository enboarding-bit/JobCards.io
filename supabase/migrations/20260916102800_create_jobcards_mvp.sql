begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 100),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  work_models text[] not null default '{}',
  minimum_salary integer check (minimum_salary is null or minimum_salary >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  title text not null,
  company text not null,
  location text not null,
  work_model text not null check (work_model in ('Remote','Hybrid','On-site')),
  salary_min integer,
  salary_max integer,
  currency text not null default 'EUR',
  fit_score smallint not null check (fit_score between 0 and 100),
  strong_signal text not null,
  watch_out text not null,
  source_url text,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  check (salary_min is null or salary_min >= 0),
  check (salary_max is null or salary_max >= salary_min)
);

create table if not exists public.job_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  status text not null check (status in ('passed','shortlisted','pursuing','applied','interview','offer','rejected')),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists job_actions_user_id_idx on public.job_actions(user_id);
create index if not exists job_actions_job_id_idx on public.job_actions(job_id);
create index if not exists job_actions_user_status_idx on public.job_actions(user_id, status);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.jobs enable row level security;
alter table public.job_actions enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "preferences_select_own" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferences_insert_own" on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "preferences_update_own" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "jobs_select_authenticated" on public.jobs for select to authenticated using (true);
create policy "actions_select_own" on public.job_actions for select to authenticated using ((select auth.uid()) = user_id);
create policy "actions_insert_own" on public.job_actions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "actions_update_own" on public.job_actions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "actions_delete_own" on public.job_actions for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.user_preferences, public.jobs, public.job_actions from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select on public.jobs to authenticated;
grant select, insert, update, delete on public.job_actions to authenticated;
grant usage, select on sequence public.job_actions_id_seq to authenticated;

commit;
