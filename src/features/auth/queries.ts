import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppRole, CurrentUser } from './types';

const ROLE_RANK: Record<AppRole, number> = {
  customer: 0,
  support: 1,
  admin: 2,
};

/**
 * The current user, or null.
 *
 * Uses `getUser()`, which validates the token with Supabase, rather than
 * `getSession()`, which just decodes a cookie the client controls. Anything
 * gating access must use this one.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Two small reads rather than a join: RLS restricts both to the caller's own
  // row, so this is not a place where a clever query saves anything.
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    // Default to the least privilege if the row is missing for any reason.
    role: (roleRow?.role as AppRole | undefined) ?? 'customer',
  };
}

/** For pages that need any signed-in user. Redirects with a return path. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * For pages that need privilege.
 *
 * Role is checked on the server on every request. It is never read from a
 * client-supplied value, never cached in a cookie, and never trusted from a
 * JWT claim we set ourselves — the database is the only authority.
 */
export async function requireRole(
  minimum: AppRole,
  returnTo: string,
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) redirect('/');
  return user;
}


/**
 * Names saved on the profile, for pre-filling forms.
 *
 * Empty strings when signed out or unset — every caller pre-fills with these, and
 * none of them treat the value as authoritative. The name that reaches an airline
 * is always the one confirmed on the form.
 */
export async function getProfileNames(): Promise<{
  givenName: string;
  familyName: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { givenName: '', familyName: '' };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('passport_given_name, passport_family_name')
    .eq('id', user.id)
    .maybeSingle<{
      passport_given_name: string | null;
      passport_family_name: string | null;
    }>();

  return {
    givenName: data?.passport_given_name ?? '',
    familyName: data?.passport_family_name ?? '',
  };
}
