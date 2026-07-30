-- Webhook delivery and pending-order resolution.
--
-- Two problems being solved:
--
-- 1. Duffel can answer order creation with **202 Accepted** — accepted, not yet
--    confirmed. Retrying a 202 can create a duplicate booking, so the only safe
--    response is to record it and wait for the `order.created` or
--    `order.creation_failed` webhook. That needs somewhere to keep the Duffel
--    order id against our attempt, and the contact email so the resolved order
--    can be recorded and the traveller told.
--
-- 2. Webhook deliveries are retried for 72 hours and are explicitly "at least
--    once", so the same event will arrive more than once. Handlers must be
--    idempotent, which needs a record of what we've already processed.

alter table public.booking_attempts
  add column if not exists duffel_order_id text,
  -- Needed to write the orders row and to contact the traveller when a pending
  -- order resolves. Minimal, purposeful, and no more than orders already holds.
  add column if not exists contact_email text;

create index if not exists booking_attempts_duffel_order_idx
  on public.booking_attempts (duffel_order_id);

/**
 * Processed webhook events.
 *
 * The primary key is Duffel's event id, so a redelivery hits a unique violation
 * and is skipped rather than reapplied. Claimed BEFORE the handler runs, for the
 * same reason booking attempts are claimed before Duffel is called.
 */
create table if not exists public.webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.webhook_events enable row level security;
-- No policies. Server-only, via the service role.

-- Airline-initiated changes we've been told about but not yet resolved.
alter table public.orders
  add column if not exists airline_change_pending boolean not null default false,
  add column if not exists airline_change_detected_at timestamptz;

create index if not exists orders_airline_change_idx
  on public.orders (airline_change_pending)
  where airline_change_pending;

comment on column public.orders.airline_change_pending is
  'The airline has changed this itinerary and nobody has actioned it yet. '
  'Surfaced at the top of the admin dashboard — a traveller who is not told '
  'finds out at the airport.';
