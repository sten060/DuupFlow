-- Track when a commission was actually paid out to the affiliate.
-- null  = not yet paid
-- value = timestamp when admin recorded the payout covering this commission
ALTER TABLE affiliate_payments
  ADD COLUMN IF NOT EXISTS commission_paid_at timestamptz;
