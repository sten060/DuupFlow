-- One-shot "your subscription was canceled" notice flag.
--
-- Set to true by the Stripe webhook when a subscription is fully canceled
-- (customer.subscription.deleted → markUserChurned). The dashboard layout
-- reads it and shows a single popup telling the user they're now on the Free
-- plan, with a CTA to re-subscribe. The popup consumes the flag on first view
-- (POST /api/account/ack-cancellation), so it appears exactly once.
--
-- Distinct from payment_overdue (mig 022): overdue = temporary past_due state
-- with a blocking, re-appearing modal; this = terminal cancellation, shown once.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cancellation_notice_pending BOOLEAN NOT NULL DEFAULT false;
