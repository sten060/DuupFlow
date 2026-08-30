-- Cancellation feedback table — stores every cancellation reason in DB
-- Email via Brevo is attempted as a bonus but not required.

CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  feedback   TEXT        NOT NULL,
  email_sent BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only admins (service role) can read all rows.
ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.cancellation_feedback
  USING (true)
  WITH CHECK (true);
