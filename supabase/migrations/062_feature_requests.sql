-- Idées d'amélioration envoyées depuis la sidebar (« Amélioration »).
-- Chaque idée est gardée ici ; un email Brevo part aussi vers hello@duupflow.com.

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  plan       TEXT,
  message    TEXT        NOT NULL,
  page       TEXT,
  email_sent BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lecture / écriture réservées au service role (aucune policy pour les users).
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
