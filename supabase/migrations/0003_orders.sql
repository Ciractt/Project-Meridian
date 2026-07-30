-- Bookings.
--
-- The governing decision here: **Duffel is the system of record for orders.**
-- This table is an index, not a copy. It holds enough to show someone their
-- trips and to support them on the phone; everything else is fetched live from
-- Duffel when a booking is opened.
--
-- Two reasons, and the second matters more:
--
--  1. Correctness. Orders change after booking — schedule changes, airline
--     cancellations, seat assignments. A local copy is stale the moment it's
--     written, and reconciling it is work with no upside.
--
--  2. Data protection. Passenger records are PII, and passport numbers are
--     about as sensitive as it gets. Under GDPR data minimisation we should
--     hold the least we can for the shortest time. Identity documents are
--     passed through to Duffel at order creation and NEVER persisted here.
--     There is deliberately no column for them.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Null for guest bookings. Not everyone will create an account, and forcing
  -- one before checkout costs conversions.
  user_id uuid references auth.users (id) on delete set null,

  duffel_order_id text not null unique,
  -- The reference the traveller quotes to the airline.
  booking_reference text,

  -- Denormalised summary, enough to render a trip list without calling Duffel.
  origin text not null,
  destination text not null,
  departure_date date not null,
  return_date date,
  passenger_count smallint not null,
  airline_name text,

  total_amount numeric(10, 2) not null,
  total_currency text not null,
  -- What we charged, which includes our markup. total_amount is what the
  -- airline charged. The difference is the margin, and it needs to be
  -- auditable per order.
  charged_amount numeric(10, 2),
  charged_currency text,

  -- Contact email, kept because customer service needs to find a booking from
  -- an inbound email with no account attached.
  contact_email text not null,

  status text not null default 'confirmed',
  created_at timestamptz not null default now(),

  -- Retention. Nothing enforces this yet; the column exists so the policy is
  -- written down next to the data rather than in a wiki nobody reads.
  purge_after date generated always as (
    (coalesce(return_date, departure_date) + interval '7 years')::date
  ) stored
);

alter table public.orders enable row level security;

create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);
create index if not exists orders_contact_email_idx on public.orders (contact_email);

-- A signed-in traveller sees their own orders. Nobody can write via a user
-- session: orders are created server-side after money has moved, so the
-- service role is the only writer.
create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

/**
 * Idempotency for order creation.
 *
 * Creating the same order twice means two tickets and a refund argument. A
 * double-clicked button, a retried serverless invocation, or a flaky network
 * can all cause it.
 *
 * The client generates an attempt token before submitting. We insert it here
 * first — the unique constraint means only one attempt can claim a token, and
 * everything else sees the claim and waits or returns the existing result.
 * This is checked BEFORE calling Duffel, so a duplicate never reaches them.
 */
create table if not exists public.booking_attempts (
  token uuid primary key,
  offer_id text not null,
  status text not null default 'in_progress',
  order_id uuid references public.orders (id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.booking_attempts enable row level security;
-- No policies. Server-only, via the service role.

create index if not exists booking_attempts_created_at_idx
  on public.booking_attempts (created_at);

/**
 * Admin view of bookings. Separate function rather than a policy on `orders`
 * so that privilege is granted in exactly one place and audited there, rather
 * than being a second RLS policy that has to stay in step with the first.
 */
create or replace function public.admin_recent_orders(max_rows integer default 50)
returns table (
  id uuid,
  duffel_order_id text,
  booking_reference text,
  origin text,
  destination text,
  departure_date date,
  passenger_count smallint,
  total_amount numeric,
  total_currency text,
  status text,
  contact_email text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    o.id, o.duffel_order_id, o.booking_reference, o.origin, o.destination,
    o.departure_date, o.passenger_count, o.total_amount, o.total_currency,
    o.status, o.contact_email, o.created_at
  from public.orders as o
  order by o.created_at desc
  limit max_rows;
$$;

revoke all on function public.admin_recent_orders(integer) from anon, authenticated;
