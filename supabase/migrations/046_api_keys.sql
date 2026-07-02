-- ============================================================
-- 046_api_keys.sql — DuupFlow public API keys
-- ============================================================
-- Stores per-user API keys for the DuupFlow API. The plaintext key is NEVER
-- stored: only its SHA-256 hash (for lookup) + a display prefix and last 4
-- chars. Additive table — nothing existing reads it, so it cannot affect the
-- dashboard duplication flow.
-- ============================================================

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'API key',
  key_hash     text not null unique,        -- SHA-256 hex of the full key
  key_prefix   text not null,               -- e.g. "dflw_live_a1b2" (display only)
  last4        text not null default '',     -- last 4 chars (display only)
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);

-- RLS defence-in-depth. All app operations go through the service-role client
-- (server actions / the API auth path) which bypasses RLS, but this ensures a
-- session/anon client can only ever see its own keys.
alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);

drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id);
