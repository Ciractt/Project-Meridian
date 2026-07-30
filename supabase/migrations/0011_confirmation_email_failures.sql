-- Confirmation email failures.
--
-- `confirmation_email_sent_at` is claimed BEFORE the send and never cleared, so
-- the send is at-most-once. That is the right trade — a duplicate confirmation is
-- worse than a missing one — but it leaves a hole: if the send fails, the flag
-- stays set, nothing retries, and the traveller gets nothing.
--
-- Which is precisely the failure this feature exists to prevent. A guest who
-- closes the tab has no other copy of their booking reference; the /booking URL
-- is only durable if they were sent it.
--
-- So the outcome is recorded rather than only logged, and failures surface in the
-- admin queue alongside stuck payments and airline changes. Same principle as
-- every other unresolved state here: never silently drop something a traveller is
-- owed.

alter table public.orders
  add column if not exists confirmation_email_failed_at timestamptz,
  add column if not exists confirmation_email_error text;

-- Partial index: the queue only ever asks for the unresolved ones.
create index if not exists orders_confirmation_failed_idx
  on public.orders (confirmation_email_failed_at)
  where confirmation_email_failed_at is not null;

comment on column public.orders.confirmation_email_failed_at is
  'Set when a claimed send failed. Cleared on a successful resend. Non-null means '
  'a paying traveller has not received their booking reference and nothing will '
  'retry automatically — it needs a human.';

/**
 * Release a failed send so it can be retried.
 *
 * Clears the claim and the failure together, atomically, so a resend goes through
 * the same at-most-once path as the original rather than bypassing it.
 */
create or replace function public.reset_confirmation_email(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders
     set confirmation_email_sent_at = null,
         confirmation_email_failed_at = null,
         confirmation_email_error = null
   where id = p_order_id;
$$;

revoke all on function public.reset_confirmation_email(uuid) from anon, authenticated;
