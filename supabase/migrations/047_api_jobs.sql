-- ============================================================
-- 047_api_jobs.sql — DuupFlow API async jobs (video processing)
-- ============================================================
-- Tracks long-running API jobs (e.g. video duplication) so the result survives
-- server restarts and the API client can poll for it. Additive table.
-- ============================================================

create table if not exists public.api_jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                     -- e.g. "videos.duplicate"
  status     text not null default 'queued',    -- queued | processing | completed | failed
  progress   int  not null default 0,           -- 0–100
  message    text,                              -- human-readable current step
  params     jsonb not null default '{}'::jsonb,
  result     jsonb,                             -- { files: [{ name, url, bytes }] }
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists api_jobs_user_id_idx on public.api_jobs(user_id);
create index if not exists api_jobs_status_idx  on public.api_jobs(status);

alter table public.api_jobs enable row level security;

-- Defence-in-depth: the API path uses the service-role client (bypasses RLS),
-- but a session/anon client can only ever read its own jobs.
drop policy if exists "api_jobs_select_own" on public.api_jobs;
create policy "api_jobs_select_own" on public.api_jobs
  for select using (auth.uid() = user_id);
