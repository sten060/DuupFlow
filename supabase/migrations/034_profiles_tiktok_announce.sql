-- One-shot launch announcement for the TikTok solution (SOFT/HARD templates +
-- "Mouvement poussé" in advanced video mode). Mirrors migration 021.
--
--   • tiktok_announce_seen_at  — when the user dismissed the launch pop-up
--                                 (via the X) or clicked its CTA. While NULL the
--                                 pop-up shows. Existing users → NULL (they see it).
--   • tiktok_reminder_sent_at  — when the 12h reminder notification fired.
--
-- Existing rows stay NULL (see the pop-up + get the reminder). The DEFAULT NOW()
-- added afterwards means FUTURE signups skip both (they discover the feature via
-- onboarding / What's New instead) — exactly like variation_ia_announced_at.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tiktok_announce_seen_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tiktok_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ALTER COLUMN tiktok_announce_seen_at SET DEFAULT NOW();

ALTER TABLE public.profiles
  ALTER COLUMN tiktok_reminder_sent_at SET DEFAULT NOW();
