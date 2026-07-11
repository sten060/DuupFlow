-- Anti-abuse: record the client IP behind each signup so we can cap how many
-- distinct accounts a single IP can create (repeat free-trial farming).
--
-- One row per email (email is globally unique in Supabase auth anyway). The
-- signup route (/api/auth/otp, signup mode) upserts email -> ip on each new
-- account and blocks a NEW email when its IP already has >= N accounts inside a
-- rolling window. Best-effort: a missing IP or a DB error never blocks signup.
--
-- Service-role only (RLS on, no policies) — written/read exclusively from the
-- server with the admin client.
CREATE TABLE IF NOT EXISTS signup_ips (
  email      TEXT PRIMARY KEY,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast "how many accounts from this IP recently" lookups.
CREATE INDEX IF NOT EXISTS signup_ips_ip_created_idx ON signup_ips (ip, created_at);

ALTER TABLE signup_ips ENABLE ROW LEVEL SECURITY;
