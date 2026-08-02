-- Requests for assistance at the airport.
--
-- ## Why this is a table and not a Duffel call
--
-- It cannot be a Duffel call. Their available-services endpoint supports
-- baggage and nothing else — their own guide says so, and says the same flow
-- will apply "once we support more ancillary services". So an assistance
-- request cannot be attached to an order through the API today, however much
-- their order-management marketing page implies otherwise.
--
-- ## Why we take it anyway
--
-- Regulation (EC) 1107/2006 Article 6, retained in UK law, requires air
-- carriers, their agents and tour operators to take all measures necessary for
-- the receipt of assistance notifications at all their points of sale,
-- including over the internet — and to transmit them onward. Selling a ticket
-- with no way to tell anyone you need a wheelchair is the gap that regulation
-- exists to close.
--
-- Whether Meridian is an "agent" for the purposes of Article 6 is a question
-- for the solicitor already reviewing terms and the ATOL position, and this
-- table does not depend on the answer: receiving the request and passing it on
-- is right regardless.
--
-- ## What the states mean, and what they do not
--
-- `forwarded` means we told the airline. It does NOT mean assistance is
-- confirmed — the airport managing body provides it, the airline arranges it,
-- and neither reports back to us. The distinction is written into the column
-- comment because it is the one thing nobody must blur when reading this table
-- to answer a traveller.

create table if not exists public.assistance_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,

  -- Which traveller on the booking, as free text. Passenger names are not
  -- stored (ADR-018), so this is what the requester typed to identify them —
  -- enough for a human to match against the order, and no more.
  passenger_label text not null,

  -- IATA SSR codes: WCHR, WCHS, WCHC, BLND, DEAF, DPNA. Stored as codes
  -- because that is what an airline understands, and rendered as sentences
  -- because that is what a traveller understands.
  codes text[] not null default '{}',

  -- Anything the codes cannot carry. Assistance needs are not a closed list and
  -- pretending otherwise is how somebody's actual requirement goes unsaid.
  notes text,

  -- received | forwarded | failed
  status text not null default 'received',
  -- How and when we passed it on: 'duffel_support', 'airline_direct', etc.
  forwarded_via text,
  forwarded_at timestamptz,
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistance_requests enable row level security;
-- Server-only, via the service role. A traveller reads their own request
-- through the booking page, which already authorises by ownership or contact
-- email; there is no client-side read path to open up.

create index if not exists assistance_requests_order_idx
  on public.assistance_requests (order_id);

-- Drives the admin queue. Oldest first, because the deadline is a departure
-- time and the oldest request is the one closest to being late.
create index if not exists assistance_requests_pending_idx
  on public.assistance_requests (status, created_at)
  where status in ('received', 'failed');

comment on column public.assistance_requests.status is
  'received = we have it. forwarded = we told the airline. NEITHER means the '
  'assistance is confirmed — the airport provides it and does not report back.';
