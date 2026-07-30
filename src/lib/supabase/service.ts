import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * Service-role Supabase client. Bypasses row-level security entirely.
 *
 * `import 'server-only'` makes importing this from a Client Component a build
 * error. That guard is the only thing between this key and a browser bundle, so
 * it is not optional.
 *
 * Returns null when no secret key is configured, and every caller must handle
 * that: the app has to work before this is set up, and a cache that can't reach
 * its store should degrade to "always miss", not crash the search page.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  // New projects issue `sb_secret_...`; older ones have a service_role JWT.
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    cached = null;
    return null;
  }

  // A publishable key here would hit RLS on tables that have no policies, so
  // every cache read would miss and every admin query return nothing — a
  // confusing failure rather than a loud one.
  if (secret.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SECRET_KEY holds a publishable key. It cannot read the search ' +
        'cache or admin tables, which are protected by RLS with no policies. ' +
        'Use a secret key from Settings → API Keys → Secret keys.',
    );
  }

  cached = createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
