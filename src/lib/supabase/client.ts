import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_CLIENT_KEY, SUPABASE_URL } from './config';

/**
 * Browser Supabase client.
 *
 * Uses the anon key, which is designed to be public — every table it can reach
 * is protected by row-level security, so the key alone grants nothing. That is
 * why the policies in supabase/migrations matter more than key secrecy.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_CLIENT_KEY,
  );
}
