-- Rate limiting on search.
--
-- Duffel meters offer requests against a search-to-book ratio, so the cost of
-- search scales with traffic while revenue scales with bookings. The cache
-- (ADR-014) already absorbs repeat queries; what it cannot absorb is a client
-- issuing endlessly *distinct* ones — walking a calendar, or enumerating
-- airport pairs. That is a bill with no ceiling and no booking behind it.
--
-- A fixed window counter rather than a token bucket. A bucket is fairer under
-- sustained load, and this is not that problem: we are stopping a scraper, not
-- shaping traffic. A counter is one row, one statement, and legible in psql at
-- three in the morning, which the bucket is not.
--
-- Postgres rather than memory because serverless functions do not share state —
-- an in-process counter on Vercel limits nothing, it just makes every cold
-- start a fresh allowance.

create table if not exists public.search_rate_limits (
  -- Caller identity. Currently an IP; kept as free text so a future signed-in
  -- or API-key identity slots in without a migration.
  bucket_key text primary key,
  -- Start of the window this count belongs to.
  window_start timestamptz not null default now(),
  -- Requests consumed in the current window.
  count integer not null default 0
);

-- Row-level security with no policies: nothing but the service role reaches
-- this table, and no client should be able to read another caller's usage or
-- write their own counter.
alter table public.search_rate_limits enable row level security;

create index if not exists search_rate_limits_window_idx
  on public.search_rate_limits (window_start);

/*
 * Consume one unit of quota, atomically.
 *
 * This has to be a function rather than a read-then-write from the
 * application. Two concurrent searches would both read the same count and both
 * write count+1, so the limit would leak by however many requests arrive in
 * parallel — which is precisely the shape of the traffic it exists to stop.
 * `insert ... on conflict do update` is a single statement and takes a row lock,
 * so concurrent callers queue rather than race.
 *
 * Returns the post-increment count and the window start, so the caller can say
 * how long until the allowance resets rather than an unqualified "try later".
 */
create or replace function public.consume_search_quota(
  p_key text,
  p_window_seconds integer
)
returns table (used integer, window_started timestamptz)
language sql
security definer
set search_path = public
as $$
  insert into public.search_rate_limits as l (bucket_key, window_start, count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set
      -- Expired window: start a new one rather than accumulating forever.
      window_start = case
        when l.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
        else l.window_start
      end,
      count = case
        when l.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
        else l.count + 1
      end
  returning l.count, l.window_start;
$$;

comment on function public.consume_search_quota is
  'Atomically increments a caller''s search count, resetting the window if it has expired. Returns the post-increment count.';
