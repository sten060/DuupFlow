-- Atomic AI-token balance change.
--
-- recordTransaction() previously did a read-modify-write (SELECT balance, then
-- UPDATE to the computed value), which let two concurrent debits both read the
-- same balance and double-spend (or drive the balance negative). This function
-- performs the debit/credit as a single conditional UPDATE so it is safe under
-- concurrency: the balance can never go below zero, and there are no lost updates.
--
-- Returns the new balance on success, or NULL when the change would overdraw the
-- account (or the user row does not exist).

create or replace function apply_ai_balance_delta(p_user_id uuid, p_delta integer)
returns integer
language plpgsql
as $$
declare
  new_balance integer;
begin
  -- COALESCE defensively treats an uninitialised balance as 0 (the column is
  -- NOT NULL DEFAULT 0, but this matches the previous read-modify-write which
  -- did `ai_balance_cents ?? 0`).
  update profiles
     set ai_balance_cents      = coalesce(ai_balance_cents, 0) + p_delta,
         ai_balance_updated_at  = now()
   where id = p_user_id
     and coalesce(ai_balance_cents, 0) + p_delta >= 0
  returning ai_balance_cents into new_balance;

  -- No row updated → either the user is missing or the debit would overdraw.
  if not found then
    return null;
  end if;

  return new_balance;
end;
$$;

-- Make the new function visible to PostgREST immediately (avoids the schema-cache
-- lag that would otherwise make admin.rpc() fail right after deploy).
notify pgrst, 'reload schema';
