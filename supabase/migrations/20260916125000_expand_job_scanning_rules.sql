alter table public.user_preferences
  add column if not exists must_have_keywords text[] not null default '{}',
  add column if not exists nice_to_have_keywords text[] not null default '{}',
  add column if not exists excluded_keywords text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists industries text[] not null default '{}',
  add column if not exists experience_levels text[] not null default '{}',
  add column if not exists employment_types text[] not null default '{}',
  add column if not exists company_sizes text[] not null default '{}',
  add column if not exists visa_sponsorship boolean,
  add column if not exists direct_apply_only boolean not null default false,
  add column if not exists max_job_age_days smallint not null default 14,
  add column if not exists scan_frequency_hours smallint not null default 6;

alter table public.user_preferences
  add constraint user_preferences_job_age_check
  check (max_job_age_days between 1 and 90);

alter table public.user_preferences
  add constraint user_preferences_scan_frequency_check
  check (scan_frequency_hours in (6, 12, 24));
