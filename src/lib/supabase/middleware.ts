import { createServerClient } from '@supabase/ssr';
import { SUPABASE_CLIENT_KEY, SUPABASE_URL } from './config';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the auth session on every matched request.
 *
 * Without this, access tokens expire mid-session and Server Components start
 * seeing a logged-out user at random. The cookie dance is fiddly but the shape
 * is fixed: write to both the request (so this render sees it) and the
 * response (so the browser keeps it).
 *
 * `getUser()` is deliberate — it validates the token against Supabase.
 * `getSession()` only decodes what the cookie claims, which is not a check.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_CLIENT_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
