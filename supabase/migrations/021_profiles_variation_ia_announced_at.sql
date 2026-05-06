-- One-shot announcement modal for the AI Variation module launch.
--
-- Logic:
--   • Existing users (created BEFORE this migration) → NULL
--     They will see the announcement on their next dashboard visit and
--     receive bonus tokens (3 for Solo, 5 for everyone else).
--   • New users (created AFTER this migration) → NOW() by default
--     They get the regular onboarding tour instead and skip this modal.
--
-- The order matters: add the column with NO default first so existing rows
-- stay NULL, then add the DEFAULT NOW() so future inserts auto-fill.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS variation_ia_announced_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ALTER COLUMN variation_ia_announced_at SET DEFAULT NOW();
