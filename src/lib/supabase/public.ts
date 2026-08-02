import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT_KEY, SUPABASE_URL } from './config';

/**
 * Server-side reads that belong to nobody.
 *
 * The difference from `createSupabaseServerClient` is that this one never
 * touches cookies — and in the App Router that is not a detail, it is the
 * difference between a page that can be cached and one that cannot. Calling
 * `cookies()` anywhere in a render marks the whole route dynamic, so a single
 * session lookup in the root layout opts every page in the product out of
 * static rendering. That is what forced the route landing pages off ISR.
 *
 * Same anon key, so the same row-level security applies: this can read exactly
 * what an unauthenticated visitor can read, and nothing more. It is not a
 * privilege escalation, it is the same privileges without the session.
 *
 * Use it for content that is identical for every visitor — site copy, route
 * pages, destination prices. Anything that depends on who is asking still needs
 * the cookie-reading client, and still makes its route dynamic, which is now a
 * deliberate cost at the page that needs it rather than a blanket one.
 *
 * A single instance: it holds no per-request state, so there is nothing to
 * isolate between requests.
 */
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_CLIENT_KEY, {
  auth: {
    /* No session to persist, refresh, or read out of a URL. Left on, the
       client would look for storage that does not exist on a server. */
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
