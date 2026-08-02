'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser, requireUser } from './queries';

/**
 * People an account holder books for.
 *
 * The point is narrow: stop somebody retyping their children's dates of birth
 * four times a year. Everything about the shape follows from that being the
 * whole ambition.
 *
 * **No identity documents, ever.** ADR-018 holds without qualification —
 * passport numbers are typed per booking, against the document actually being
 * carried, and passed straight through to Duffel. Saving them would turn a
 * convenience into the most valuable table in the database, and it would not
 * even work reliably: passports expire and get replaced, so a stored number is
 * a number that is wrong at exactly the moment it matters.
 *
 * Everything here is somebody else's personal data, entered by a third party
 * who was not asked. That is normal and lawful for a booking, and it is the
 * reason the list is short, the delete is immediate, and none of it is used for
 * anything except filling in a form.
 */

export interface TravellerProfile {
  id: string;
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
  nickname: string | null;
}

const travellerSchema = z.object({
  title: z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']),
  givenName: z
    .string()
    .trim()
    .min(1, 'Enter a first name.')
    .max(60)
    /* Same rule as checkout. A name saved here that the airline will reject is
       worse than no saved name — it fails at the point of paying. */
    .regex(/^[\p{L}\p{M}\s'-]+$/u, 'Letters, hyphens and apostrophes only.'),
  familyName: z
    .string()
    .trim()
    .min(1, 'Enter a last name.')
    .max(60)
    .regex(/^[\p{L}\p{M}\s'-]+$/u, 'Letters, hyphens and apostrophes only.'),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  gender: z.enum(['m', 'f']),
  nickname: z.string().trim().max(40).optional(),
});

export type TravellerState = { error?: string; notice?: string };

/** Everyone this account has saved. Empty for guests, by construction. */
export async function getTravellerProfiles(): Promise<TravellerProfile[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('traveller_profiles')
    .select('id, title, given_name, family_name, born_on, gender, nickname')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Could not load traveller profiles:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ? String(row.title) : 'mr',
    givenName: String(row.given_name),
    familyName: String(row.family_name),
    bornOn: row.born_on ? String(row.born_on) : '',
    gender: row.gender ? String(row.gender) : 'f',
    nickname: row.nickname ? String(row.nickname) : null,
  }));
}

export async function saveTravellerProfile(
  _previous: TravellerState,
  formData: FormData,
): Promise<TravellerState> {
  const user = await requireUser('/account/settings');

  const parsed = travellerSchema.safeParse({
    title: formData.get('title'),
    givenName: formData.get('givenName') ?? '',
    familyName: formData.get('familyName') ?? '',
    bornOn: formData.get('bornOn') ?? '',
    gender: formData.get('gender'),
    nickname: formData.get('nickname') ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');

  const values = {
    title: parsed.data.title,
    given_name: parsed.data.givenName,
    family_name: parsed.data.familyName,
    born_on: parsed.data.bornOn,
    gender: parsed.data.gender,
    nickname: parsed.data.nickname || null,
    updated_at: new Date().toISOString(),
  };

  /* user_id is set on insert and never on update — the row's owner is not
     something a form gets to change. RLS would refuse anyway; this means the
     request never carries the field to refuse. */
  const { error } = id
    ? await supabase
        .from('traveller_profiles')
        .update(values)
        .eq('id', id)
        .eq('user_id', user.id)
    : await supabase
        .from('traveller_profiles')
        .insert({ ...values, user_id: user.id });

  if (error) {
    console.error('Could not save traveller profile:', error.message);
    return { error: 'Could not save that.' };
  }

  revalidatePath('/account/settings');
  return { notice: id ? 'Saved.' : 'Saved. They’ll appear at checkout.' };
}

/**
 * Remove someone.
 *
 * Immediate and complete — no soft delete, no archive. This is data about a
 * person who is not the account holder, and "we kept a copy" is not an answer
 * anyone wants to hear. Bookings already made are unaffected: those live with
 * Duffel and never referenced this row.
 */
export async function deleteTravellerProfile(
  _previous: TravellerState,
  formData: FormData,
): Promise<TravellerState> {
  const user = await requireUser('/account/settings');
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Nothing to remove.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('traveller_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Could not delete traveller profile:', error.message);
    return { error: 'Could not remove that.' };
  }

  revalidatePath('/account/settings');
  return { notice: 'Removed.' };
}
