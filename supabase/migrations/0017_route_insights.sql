-- Richer observations per route, for the landing pages.
--
-- A route page that says "Flights from Newcastle to Malaga" above a search box is
-- a doorway page: thin, indistinguishable from ten thousand others, and the exact
-- thing search engines demote. What makes such a page worth existing is saying
-- something true and specific about the route.
--
-- So we record what we actually observe when people search: which airlines came
-- back, how long the quickest itinerary was, whether a direct exists. Everything
-- on the page is then substantiated by a real search, and a route we know little
-- about gets a page that admits it rather than one padded with invention.
--
-- Same free-as-a-by-product principle as the prices themselves (ADR-034).

alter table public.route_prices
  -- Marketing carriers seen on this route, most recent search wins.
  add column if not exists airlines text[] not null default '{}',
  -- Shortest total journey observed, minutes.
  add column if not exists fastest_minutes integer,
  -- Whether any offer had no stops. Null means we've never looked.
  add column if not exists direct_available boolean,
  -- How many searches have contributed. Low counts mean low confidence, and the
  -- page says so instead of asserting a pattern from one data point.
  add column if not exists observation_count integer not null default 0;

/**
 * Record an observation, now including what we saw rather than only the price.
 *
 * Replaces the earlier two-argument version. Still overwrites rather than keeping
 * minimums — see 0008 for why an all-time low is the worst number to display.
 */
create or replace function public.record_route_price(
  p_origin text,
  p_destination text,
  p_amount numeric,
  p_currency text,
  p_departure_date date,
  p_return_date date,
  p_airlines text[] default '{}',
  p_fastest_minutes integer default null,
  p_direct_available boolean default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.route_prices as rp
    (origin, destination, cheapest_amount, currency, departure_date, return_date,
     airlines, fastest_minutes, direct_available, observation_count, observed_at)
  values
    (p_origin, p_destination, p_amount, p_currency, p_departure_date, p_return_date,
     p_airlines, p_fastest_minutes, p_direct_available, 1, now())
  on conflict (origin, destination) do update
    set cheapest_amount   = excluded.cheapest_amount,
        currency          = excluded.currency,
        departure_date    = excluded.departure_date,
        return_date       = excluded.return_date,
        airlines          = excluded.airlines,
        fastest_minutes   = excluded.fastest_minutes,
        direct_available  = excluded.direct_available,
        observation_count = rp.observation_count + 1,
        observed_at       = now();
$$;

revoke all on function public.record_route_price(
  text, text, numeric, text, date, date, text[], integer, boolean
) from anon, authenticated;

-- The landing pages read these publicly, so relax the freshness window: a route
-- page for somewhere nobody has searched this fortnight should still exist and
-- simply say the price is old.
drop policy if exists "route_prices_select_recent" on public.route_prices;

create policy "route_prices_select_all"
  on public.route_prices for select
  using (true);
