-- Extras (bags, seats) on a booking attempt.
--
-- Stored server-side for the same reason the offer and payment intent are: the
-- second half of checkout must not be steerable from the browser. The selected
-- service IDs and the amount owed to the airline are read from HERE when the
-- order is created, never from the request body.

alter table public.booking_attempts
  add column if not exists services jsonb not null default '[]'::jsonb,
  add column if not exists extras_amount numeric(10, 2) not null default 0,
  -- fare + extras: what the airline will take from our balance. This is the
  -- figure the confirmed payment has to cover, not the fare alone.
  add column if not exists supplier_amount numeric(10, 2);

alter table public.orders
  add column if not exists extras_amount numeric(10, 2) not null default 0;

comment on column public.booking_attempts.supplier_amount is
  'fare + extras, owed to the airline. The coverage check compares the settled '
  'net payment against THIS, not against the fare.';
