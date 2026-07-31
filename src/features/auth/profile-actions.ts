'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from './queries';

export interface ProfileState {
  error?: string;
  notice?: string;
}

const nameSchema = z.object({
  givenName: z.string().trim().max(40),
  familyName: z.string().trim().max(40),
});

const addressSchema = z.object({
  line1: z.string().trim().max(120),
  line2: z.string().trim().max(120),
  city: z.string().trim().max(80),
  postcode: z.string().trim().max(20),
  country: z.string().trim().max(60),
});

/**
 * The name used to pre-fill booking forms.
 *
 * Editable, deliberately. A permanently locked legal name strands anyone who
 * marries, divorces, changes it by deed poll or obtains a gender recognition
 * certificate — and it would buy nothing, because the name that reaches the
 * airline is the one confirmed at checkout against the actual document, not this.
 */
export async function saveTravellerName(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser('/account/settings');
  const parsed = nameSchema.safeParse({
    givenName: formData.get('givenName') ?? '',
    familyName: formData.get('familyName') ?? '',
  });
  if (!parsed.success) return { error: 'Check the names you entered.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      passport_given_name: parsed.data.givenName || null,
      passport_family_name: parsed.data.familyName || null,
    })
    .eq('id', user.id);

  if (error) return { error: 'Could not save that.' };
  revalidatePath('/account/settings');
  return { notice: 'Saved. We’ll use this to fill in booking forms.' };
}

export async function saveAddress(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser('/account/settings');
  const parsed = addressSchema.safeParse({
    line1: formData.get('line1') ?? '',
    line2: formData.get('line2') ?? '',
    city: formData.get('city') ?? '',
    postcode: formData.get('postcode') ?? '',
    country: formData.get('country') ?? '',
  });
  if (!parsed.success) return { error: 'Check the address you entered.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      address_line1: parsed.data.line1 || null,
      address_line2: parsed.data.line2 || null,
      address_city: parsed.data.city || null,
      address_postcode: parsed.data.postcode || null,
      address_country: parsed.data.country || null,
    })
    .eq('id', user.id);

  if (error) return { error: 'Could not save that.' };
  revalidatePath('/account/settings');
  return { notice: 'Address saved.' };
}

/**
 * Changing the sign-in email.
 *
 * Supabase sends a confirmation to the NEW address and only switches once it is
 * clicked — so a typo locks nobody out, and someone who gains brief access to a
 * session can't quietly take the account over.
 */
export async function changeEmail(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  await requireUser('/account/settings');
  const email = z.string().email().safeParse(formData.get('email'));
  if (!email.success) return { error: 'That doesn’t look like an email address.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: email.data });

  if (error) return { error: error.message };
  return {
    notice: `We’ve sent a confirmation link to ${email.data}. Your address changes once you click it.`,
  };
}

export async function changePassword(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  await requireUser('/account/settings');

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    return { error: 'Passwords need to be at least 8 characters.' };
  }
  if (password !== confirm) return { error: 'Those two passwords don’t match.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };
  return { notice: 'Password changed.' };
}
