-- Ajout du champ stripe_promotion_code_id sur la table affiliates
-- Chaque affilié a son propre Stripe Promotion Code lié à un coupon -10€
alter table affiliates
  add column if not exists stripe_promotion_code_id text;
