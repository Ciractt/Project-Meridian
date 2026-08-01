import 'server-only';
import { headers } from 'next/headers';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * How many live searches one caller gets per window.
 *
 * **This counts offer requests, not page views.** A cache hit costs us nothing,
 * so it is not charged against the allowance — which means a traveller
 * comparing the same handful of date pairs can flip between them freely, while
 * a client walking a calendar one distinct day at a time is charged for every
 * step. The behaviour we want to stop and the behaviour we want to allow
 * differ precisely on whether the cache can answer, so that is the line the
 * limiter draws.
 *
 * The numbers are deliberately generous. Planning a trip properly means a lot
 * of distinct searches, shared IPs are common — a household, an office, a
 * mobile carrier's NAT — and the cost of turning away a real traveller is much
 * higher than the cost of a few extra offer requests. This stops a scraper, not
 * an enthusiast.
 */
const LIMIT = Number(process.env.SEARCH_RATE_LIMIT ?? '40');
const WINDOW_SECONDS = Number(process.env.SEARCH_RATE_WINDOW_SECONDS ?? '900');

export type QuotaOutcome =
  | { status: 'allowed' }
  /** Over the limit. `retryAfterSeconds` is how long until the window resets. */
  | { status: 'throttled'; retryAfterSeconds: number }
  /** Could not be determined. Callers let the search through — see below. */
  | { status: 'unknown' };

/**
 * Who is asking.
 *
 * `x-forwarded-for` is a list; the leftmost entry is the client and the rest
 * are proxies. It is client-supplied and therefore forgeable, which is worth
 * being clear about: this limiter raises the cost of scraping, it does not make
 * it impossible. Someone rotating addresses defeats it. That is an acceptable
 * bar for a spend control — the thing being protected is a bill, not a booking,
 * and the alternatives (accounts, captchas, proof of work) all tax real
 * travellers to stop a determined few.
 *
 * On Vercel `x-forwarded-for` is set by the platform and cannot be spoofed by
 * the client for the leftmost entry, which makes the practical bar higher than
 * the theoretical one.
 */
async function callerKey(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return `ip:${first}`;

  const real = store.get('x-real-ip')?.trim();
  if (real) return `ip:${real}`;

  /* No address at all — local development, or a proxy that strips it. Returning
     null makes the caller skip the limit rather than lump every request into
     one shared bucket, which would rate-limit a whole dev machine to nothing. */
  return null;
}

/**
 * Charge one live search against the caller's allowance.
 *
 * **Fails open.** If Supabase is unreachable or the function is missing, this
 * returns `unknown` and the search proceeds. A limiter that blocks searching
 * when its own storage is down converts a cost problem into an outage, and the
 * thing at risk is a bill rather than a booking. The failure is logged so it is
 * visible rather than silent.
 */
export async function consumeSearchQuota(): Promise<QuotaOutcome> {
  if (!Number.isFinite(LIMIT) || LIMIT <= 0) return { status: 'unknown' };

  const key = await callerKey();
  if (!key) return { status: 'unknown' };

  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unknown' };

  try {
    const { data, error } = await supabase
      .rpc('consume_search_quota', { p_key: key, p_window_seconds: WINDOW_SECONDS })
      .maybeSingle<{ used: number; window_started: string }>();

    if (error || !data) {
      console.error('Search rate limit unavailable:', error?.message ?? 'no row');
      return { status: 'unknown' };
    }

    if (data.used <= LIMIT) return { status: 'allowed' };

    const windowEndsAt = new Date(data.window_started).getTime() + WINDOW_SECONDS * 1000;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowEndsAt - Date.now()) / 1000),
    );
    return { status: 'throttled', retryAfterSeconds };
  } catch (cause) {
    console.error('Search rate limit unavailable:', cause);
    return { status: 'unknown' };
  }
}

/** "12 minutes", "45 seconds" — for telling someone when to come back. */
export function describeRetryAfter(seconds: number): string {
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
