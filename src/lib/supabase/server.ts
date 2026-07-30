import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_CLIENT_KEY, SUPABASE_URL } from './config';
import { cookies } from 'next/headers';

/**
 * Server Supabase client, bound to the request's cookies so the session is
 * read and refreshed per request.
 *
 * The `try/catch` around setAll is required, not defensive: Server Components
 * are not allowed to write cookies. When one calls this, the write throws and
 * we swallow it — middleware has already refreshed the session, so nothing is
 * lost. Server Actions and Route Handlers can write, and there it succeeds.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_CLIENT_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component. Safe to ignore.
          }
        },
      },
    },
  );
}
