'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AuthFormState {
  error?: string;
  notice?: string;
}

const credentials = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

/**
 * Sign-in and sign-up as Server Actions.
 *
 * Credentials never touch a Route Handler we'd have to secure separately, and
 * the browser bundle contains no auth logic. Error messages are deliberately
 * vague about which half was wrong — "email not found" is an account
 * enumeration oracle.
 */
export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: 'That email and password combination didn’t work.' };

  const next = String(formData.get('next') ?? '/account');
  revalidatePath('/', 'layout');
  // Only allow same-origin redirects; `next` comes from a query string.
  redirect(next.startsWith('/') ? next : '/account');
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { full_name: String(formData.get('fullName') ?? '').trim() || null },
    },
  });

  if (error) return { error: error.message };

  return {
    notice: 'Check your email to confirm your address, then sign in.',
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
