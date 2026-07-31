'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  applyLoyaltyToOffer,
  getSavedLoyaltyAccounts,
  loyaltyAccountSchema,
  saveLoyaltyAccounts,
  type ApplyResult,
} from './loyalty';

const schema = z.object({
  offerId: z.string().min(1),
  passengerIds: z.string().min(1),
  supportedProgrammes: z.string(),
  airline: z.string(),
  accountNumber: z.string(),
  givenName: z.string().trim().min(1, 'The airline needs the name on the account.'),
  familyName: z.string().trim().min(1, 'The airline needs the name on the account.'),
  remember: z.string().optional(),
});

export async function applyLoyalty(
  _previous: ApplyResult | null,
  formData: FormData,
): Promise<ApplyResult> {
  const parsed = schema.safeParse({
    offerId: formData.get('offerId'),
    passengerIds: formData.get('passengerIds'),
    supportedProgrammes: formData.get('supportedProgrammes') ?? '',
    airline: formData.get('airline'),
    accountNumber: formData.get('accountNumber'),
    givenName: formData.get('givenName'),
    familyName: formData.get('familyName'),
    remember: formData.get('remember') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'unavailable',
      message: parsed.error.issues[0]?.message ?? 'Check the details you entered.',
    };
  }

  const account = loyaltyAccountSchema.safeParse({
    airline: parsed.data.airline,
    accountNumber: parsed.data.accountNumber,
  });
  if (!account.success) {
    return { status: 'unavailable', message: 'That membership number doesn’t look right.' };
  }

  const result = await applyLoyaltyToOffer({
    offerId: parsed.data.offerId,
    passengerIds: parsed.data.passengerIds.split(',').filter(Boolean),
    supportedProgrammes: parsed.data.supportedProgrammes.split(',').filter(Boolean),
    account: account.data,
    givenName: parsed.data.givenName,
    familyName: parsed.data.familyName,
  });

  if (result.status === 'applied') {
    if (parsed.data.remember === 'on') {
      const existing = await getSavedLoyaltyAccounts();
      const merged = [
        account.data,
        ...existing.filter((item) => item.airline !== account.data.airline),
      ].slice(0, 10);
      await saveLoyaltyAccounts(merged);
    }

    /* The page re-prices on load, so revalidating is what surfaces any change the
       airline made — a lower fare, an extra bag, seat selection. Without this the
       call would succeed invisibly. */
    revalidatePath(`/book/${parsed.data.offerId}`);
  }

  return result;
}
