-- Order cancellations.
--
-- The money moves in two hops and conflating them would strand a refund:
--
--   1. The airline refunds to OUR Duffel balance. That is what
--      `refund_amount` on a Duffel cancellation means — it is not a credit to
--      the traveller's card.
--   2. We then refund the traveller's card through Duffel Payments, against the
--      original payment intent.
--
-- Confirming step 1 without step 2 leaves us holding their money with their
-- booking cancelled, which is the worst outcome in the system. So both are
-- recorded, and a completed step 1 with a failed step 2 is surfaced for a human
-- exactly like a failed booking refund.

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  -- What the AIRLINE returned to our balance.
  add column if not exists airline_refund_amount numeric(10, 2),
  add column if not exists airline_refund_currency text,
  add column if not exists airline_refund_to text,
  -- What we returned to the traveller's card, and the Duffel Payments refund id.
  add column if not exists customer_refund_amount numeric(10, 2),
  add column if not exists customer_refund_id text,
  add column if not exists customer_refund_failed_at timestamptz,
  add column if not exists customer_refund_error text,
  add column if not exists duffel_cancellation_id text;

create index if not exists orders_customer_refund_failed_idx
  on public.orders (customer_refund_failed_at)
  where customer_refund_failed_at is not null;

comment on column public.orders.customer_refund_failed_at is
  'The airline cancellation was confirmed but refunding the traveller''s card '
  'failed. We are holding money for a booking that no longer exists — the '
  'highest-severity state in the system. Surfaced at the top of /admin.';
