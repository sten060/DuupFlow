-- AI token balance + ledger (pay-per-use AI variation feature).
--
-- Storage strategy: balance is stored in INTEGER cents to avoid float
-- precision issues. The "token" is a marketing abstraction (1 token = 0.40 €)
-- — the UI converts cents → tokens at display time.
--
-- Pricing reminders (kept in src/lib/tokens.ts):
--   1 image Solo = 90 cents = 2.25 tokens
--   1 image Pro  = 70 cents = 1.75 tokens

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_balance_cents     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_balance_updated_at TIMESTAMPTZ;

-- Per-user transaction history. Every credit (topup, refund) and debit
-- (image generation) writes one row here. Balance can always be
-- reconstructed by SUM(delta_cents) GROUP BY user_id.
CREATE TABLE IF NOT EXISTS public.ai_token_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta_cents INTEGER NOT NULL,
  reason      TEXT NOT NULL,        -- 'topup' | 'topup_admin' | 'image_solo' | 'image_pro' | 'refund_failure' | 'admin_adjust'
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_ledger_user_created
  ON public.ai_token_ledger(user_id, created_at DESC);

-- RLS: a user can only read their own ledger. Writes happen server-side
-- via the service-role client (bypasses RLS).
ALTER TABLE public.ai_token_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own ledger" ON public.ai_token_ledger;
CREATE POLICY "Users can read own ledger" ON public.ai_token_ledger
  FOR SELECT USING (auth.uid() = user_id);
