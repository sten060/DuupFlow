-- ============================================================
-- Migration 009 : historique des paiements affiliés
-- Enregistré automatiquement à chaque invoice.paid Stripe
-- ============================================================

CREATE TABLE public.affiliate_payments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code      TEXT        NOT NULL REFERENCES public.affiliates(code),
  user_id             UUID        NOT NULL REFERENCES auth.users(id),
  stripe_invoice_id   TEXT        NOT NULL UNIQUE,        -- idempotence
  amount_cents        INTEGER     NOT NULL,               -- montant payé par le client
  commission_cents    INTEGER     NOT NULL,               -- commission due à l'affilié
  commission_pct      INTEGER     NOT NULL,               -- taux au moment du paiement
  plan                TEXT        NOT NULL,               -- 'solo' | 'pro'
  billing_reason      TEXT,                               -- 'subscription_create' | 'subscription_cycle' …
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un affilié peut consulter ses propres paiements
ALTER TABLE public.affiliate_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliates_see_own_payments"
  ON public.affiliate_payments FOR SELECT
  USING (
    affiliate_code = (
      SELECT code FROM public.affiliates WHERE user_id = auth.uid() LIMIT 1
    )
  );
