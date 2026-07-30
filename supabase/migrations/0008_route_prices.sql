-- Indicative route prices for the home page.
--
-- Populated as a by-product of real searches. When someone searches NCL→AGP and
-- we get live offers back, we record the cheapest. That means the home page fills
-- itself in as traffic arrives, at **zero additional API cost** — which matters,
-- because the alternative is running searches nobody asked for and burning the
-- search-to-book ratio the cache exists to protect (ADR-016).
--
-- Deliberately NOT a minimum-ever table. Each observation overwrites the last, so
-- the figure shown is always the most recent one seen rather than an all-time low
-- that stopped being achievable months ago. "Prices seen recently" is then
-- literally true, which is the only version worth putting on a home page.

create table if not exists public.route_prices (
  origin text not null,
  destination text not null,
  cheapest_amount numeric(10, 2) not null,
  currency text not null,
  -- Cheapest itinerary's dates, so the figure has context.
  departure_date date,
  return_date date,
  observed_at timestamptz not null default now(),
  primary key (origin, destination)
);

alter table public.route_prices enable row level security;

-- Read-only, and only while recent. A price nobody has seen for a fortnight has
-- no business being displayed as indicative, so the policy — not application
-- code — decides what counts as current.
create policy "route_prices_select_recent"
  on public.route_prices for select
  using (observed_at > now() - interval '7 days');

-- No write policies. Recorded server-side via the service role.

/**
 * Record an observation. Always overwrites — see the note above about minimums.
 */
create or replace function public.record_route_price(
  p_origin text,
  p_destination text,
  p_amount numeric,
  p_currency text,
  p_departure_date date,
  p_return_date date
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.route_prices as rp
    (origin, destination, cheapest_amount, currency, departure_date, return_date, observed_at)
  values
    (p_origin, p_destination, p_amount, p_currency, p_departure_date, p_return_date, now())
  on conflict (origin, destination) do update
    set cheapest_amount = excluded.cheapest_amount,
        currency        = excluded.currency,
        departure_date  = excluded.departure_date,
        return_date     = excluded.return_date,
        observed_at     = now();
$$;

revoke all on function public.record_route_price(text, text, numeric, text, date, date)
  from anon, authenticated;
