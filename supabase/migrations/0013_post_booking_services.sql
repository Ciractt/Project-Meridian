-- Bags bought after booking.
--
-- Mirrors booking_attempts, for the same reason: money moves twice (card → our
-- balance → the airline) and a double-click must not buy two bags. The token is
-- generated client-side and claimed here before anything is charged.

create table if not exists public.service_purchases (
  token uuid primary key,
  order_id uuid not null references public.orders (id) on delete cascade,

  services jsonb not null default '[]'::jsonb,
  -- Owed to the airline. What our balance has to cover.
  supplier_amount numeric(10, 2),
  -- What the card is charged: supplier plus our ancillary margin, grossed up.
  charge_amount numeric(10, 2),
  currency text,

  payment_intent_id text,
  refund_id text,

  -- awaiting_payment | paid_not_delivered | completed | failed
  status text not null default 'awaiting_payment',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.service_purchases enable row level security;
-- No policies. Server-only, via the service role.

create index if not exists service_purchases_order_idx
  on public.service_purchases (order_id);

create index if not exists service_purchases_attention_idx
  on public.service_purchases (status)
  where status = 'paid_not_delivered';

comment on column public.service_purchases.status is
  'paid_not_delivered means the card was charged and the airline did not add the '
  'bag — a refund is owed. Surfaced in /admin like every other state where we '
  'hold money for something the traveller did not receive.';
