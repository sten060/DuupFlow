-- Payment overdue tracking — auto-downgrade to Free when a Stripe payment
-- fails (past_due / payment_failed), auto-restore when payment resumes.
--
-- Columns:
--   payment_overdue       — drives the blocking modal in the dashboard
--   paused_plan           — remembers the original plan so we can restore it
--                           when the user pays again (set when pausing,
--                           cleared when resuming)
--   payment_overdue_since — timestamp of first failure, for UI display

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_overdue       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_plan           TEXT,
  ADD COLUMN IF NOT EXISTS payment_overdue_since TIMESTAMPTZ;
