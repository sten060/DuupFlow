-- Coordonnées de paiement renseignées par le partenaire
-- Stockées en JSONB flexible : { iban, bic, account_name, paypal }
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS payment_info JSONB;
