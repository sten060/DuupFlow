-- Table de suivi des versements manuels aux partenaires
-- Chaque ligne = un virement réel effectué à un affilié
create table public.affiliate_payouts (
  id          uuid        primary key default gen_random_uuid(),
  affiliate_code text      not null references public.affiliates(code) on delete cascade,
  amount_cents   integer   not null check (amount_cents > 0),
  note           text,
  paid_at        timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index on public.affiliate_payouts (affiliate_code);

-- RLS : le partenaire voit uniquement ses propres versements
alter table public.affiliate_payouts enable row level security;

create policy "affiliate sees own payouts"
  on public.affiliate_payouts for select
  using (
    affiliate_code = (
      select code from public.affiliates where user_id = auth.uid()
    )
  );
