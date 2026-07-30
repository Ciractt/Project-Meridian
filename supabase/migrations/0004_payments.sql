-- Payment tracking.
--
-- `booking_attempts` becomes the state machine for a checkout. It holds the
-- money-relevant facts server-side so that the second half of the flow cannot
-- be steered by the client: the offer being booked and the payment intent
-- charged are read from HERE, never from the request body.
--
-- Without that binding, a caller could pay for a cheap offer and then ask us to
-- book an expensive one.

alter table public.booking_attempts
  add column if not exists payment_intent_id text,
  add column if not exists charge_amount numeric(10, 2),
  add column if not exists charge_currency text,
  add column if not exists fare_amount numeric(10, 2),
  add column if not exists refund_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists booking_attempts_payment_intent_idx
  on public.booking_attempts (payment_intent_id);

create index if not exists booking_attempts_status_idx
  on public.booking_attempts (status)
  where status in ('needs_reconciliation', 'paid_not_ticketed');

comment on column public.booking_attempts.status is
  'awaiting_payment | paid_not_ticketed | needs_reconciliation | completed | failed. '
  '"paid_not_ticketed" means money was taken and no ticket exists — refund owed. '
  '"needs_reconciliation" means order creation timed out and a ticket MAY exist; '
  'these must be checked against Duffel by hand and never blindly retried.';

/**
 * Attempts that need a human.
 *
 * Both states involve a traveller who has paid and does not yet have a clear
 * outcome, so this is the highest-priority queue in the business. It goes on the
 * admin dashboard rather than into a log.
 */
create or replace function public.admin_attention_attempts()
returns table (
  token uuid,
  offer_id text,
  status text,
  failure_reason text,
  payment_intent_id text,
  charge_amount numeric,
  charge_currency text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    a.token, a.offer_id, a.status, a.failure_reason, a.payment_intent_id,
    a.charge_amount, a.charge_currency, a.created_at
  from public.booking_attempts as a
  where a.status in ('needs_reconciliation', 'paid_not_ticketed')
  order by a.created_at desc
  limit 100;
$$;

revoke all on function public.admin_attention_attempts() from anon, authenticated;
