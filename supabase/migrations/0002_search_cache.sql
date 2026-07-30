-- Search cache.
--
-- Duffel meters offer requests against a search-to-book ratio, and consumer
-- flight search has a terrible look-to-book rate: most visitors browse. Without
-- a cache, a back button, a refresh, two people on the same popular route, and
-- every crawler each cost a full offer request.
--
-- This table is server-only. RLS is enabled with NO policies whatsoever, so
-- neither the anon nor the authenticated role can read or write it. Access is
-- via the secret (service-role) key from server code only. That is deliberate:
-- cached fares are commercial data and the offer IDs inside are bookable.

create table if not exists public.search_cache (
  -- sha256 of the canonical criteria plus a schema version.
  key text primary key,
  schema_version smallint not null,
  -- Kept human-readable so the admin screens and any future analytics can
  -- group by route without re-deriving anything from the hash.
  origin text not null,
  destination text not null,
  departure_date date not null,
  return_date date,
  cabin text not null,
  passenger_count smallint not null,
  direct_only boolean not null default false,
  -- Mapped domain offers, not raw Duffel payloads.
  offers jsonb not null,
  offer_count smallint not null,
  duffel_offer_request_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count integer not null default 0
);

alter table public.search_cache enable row level security;

create index if not exists search_cache_expires_at_idx
  on public.search_cache (expires_at);

create index if not exists search_cache_route_idx
  on public.search_cache (origin, destination, created_at desc);

/**
 * Read and count a hit in one round trip.
 *
 * An UPDATE ... RETURNING is atomic and saves a second call on the hot path.
 * The expiry check lives in the WHERE clause, so a stale row simply returns no
 * rows rather than needing to be checked in application code.
 */
create or replace function public.touch_search_cache(
  cache_key text,
  wanted_schema_version smallint
)
returns table (offers jsonb, offer_count smallint, expires_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  update public.search_cache as c
     set hit_count = c.hit_count + 1
   where c.key = cache_key
     and c.schema_version = wanted_schema_version
     and c.expires_at > now()
  returning c.offers, c.offer_count, c.expires_at;
$$;

revoke all on function public.touch_search_cache(text, smallint) from anon, authenticated;

/**
 * Housekeeping. Called opportunistically on cache writes rather than needing a
 * scheduled job — cheap because expires_at is indexed, and the table only
 * grows as fast as people search.
 */
create or replace function public.prune_search_cache()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.search_cache where expires_at < now() - interval '1 hour';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_search_cache() from anon, authenticated;

/**
 * Aggregates for the admin screens.
 *
 * `hit_count` is the number of searches served without touching Duffel, so
 * hit_count / (hit_count + rows) is the proportion of demand the cache
 * absorbed — the single number that tells you whether the search bill is
 * under control.
 */
create or replace function public.search_cache_stats(since interval default '7 days')
returns table (
  cached_searches bigint,
  cache_hits bigint,
  live_searches bigint,
  distinct_routes bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    count(*)::bigint as cached_searches,
    coalesce(sum(hit_count), 0)::bigint as cache_hits,
    count(*)::bigint as live_searches,
    count(distinct (origin, destination))::bigint as distinct_routes
  from public.search_cache
  where created_at > now() - since;
$$;

create or replace function public.search_cache_top_routes(
  since interval default '7 days',
  max_rows integer default 10
)
returns table (
  origin text,
  destination text,
  searches bigint,
  hits bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    c.origin,
    c.destination,
    count(*)::bigint as searches,
    coalesce(sum(c.hit_count), 0)::bigint as hits
  from public.search_cache as c
  where c.created_at > now() - since
  group by c.origin, c.destination
  order by count(*) desc, sum(c.hit_count) desc
  limit max_rows;
$$;

revoke all on function public.search_cache_stats(interval) from anon, authenticated;
revoke all on function public.search_cache_top_routes(interval, integer) from anon, authenticated;
