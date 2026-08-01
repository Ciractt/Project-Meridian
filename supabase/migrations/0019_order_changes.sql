-- Changes to an existing booking.
--
-- Mirrors booking_attempts and service_purchases, for the same reason: money
-- moves twice (card → our balance → the airline) and a double-click must not
-- buy two changes. The token is generated client-side and claimed here before
-- anything is charged.
--
-- A change is worse than a bag if it goes wrong. A failed bag purchase leaves a
-- booking intact; a change that takes payment and then fails to confirm leaves
-- someone holding a ticket for a flight they believe they are no longer on. So
-- the states are recorded with the same care as an order, and the same
-- reconciliation queue picks them up.

create table if not exists public.order_changes (
  token uuid primary key,
  order_id uuid not null references public.orders (id) on delete cascade,

  -- Duffel's ids, kept so a stuck change can be traced by hand.
  duffel_order_change_id text,
  duffel_order_change_offer_id text,

  -- Which leg is being replaced, and with what. Stored for the audit trail:
  -- when someone asks why their flight moved, this is the answer.
  removed_slice_id text,
  new_origin text,
  new_destination text,
  new_departure_date date,

  -- Signed, as the airline reports it. Negative means they owe the traveller.
  airline_amount numeric(10, 2),
  -- Our flat handling fee. Zero when the change is free or in their favour.
  handling_fee numeric(10, 2),
  -- What the card was charged. Never negative.
  charge_amount numeric(10, 2),
  currency text,

  payment_intent_id text,
  refund_id text,

  -- awaiting_payment | paid_not_changed | completed | failed
  --
  -- paid_not_changed is the one that matters: the card was charged and the
  -- airline has not confirmed. Same shape as paid_not_ticketed, and picked up
  -- by the same reconciliation pass.
  status text not null default 'awaiting_payment',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.order_changes enable row level security;
-- No policies. Server-only, via the service role — the same posture as every
-- other table that moves money.

create index if not exists order_changes_order_idx
  on public.order_changes (order_id);

-- Drives the admin queue: anything charged but not confirmed, oldest first.
create index if not exists order_changes_attention_idx
  on public.order_changes (status, created_at)
  where status in ('paid_not_changed', 'failed');
