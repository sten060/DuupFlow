-- Ajoute discount_pct sur les affiliés "lien seul" (pas de code promo visible)
-- null  = ancien comportement (code promo -10€ fixe)
-- valeur = % de réduction auto-appliqué via le lien ?ref=CODE
alter table public.affiliates
  add column if not exists discount_pct integer default null;
