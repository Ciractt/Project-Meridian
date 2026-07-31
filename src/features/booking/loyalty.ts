import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/features/auth/queries';
import { updateOfferPassenger } from '@/services/duffel/flights';

/**
 * Frequent-flyer numbers, applied to an offer.
 *
 * Why this is worth building: a membership number can lower the fare, add
 * baggage, or unlock free seat selection — and it lets the traveller earn points,
 * which is one of the main reasons people book direct rather than through an
 * agent. Not offering it is a standing argument for going elsewhere.
 *
 * Applied AFTER the offer exists rather than at search, because airlines only
 * accept a loyalty account alongside the traveller's name. Collecting it at
 * search would mean asking for names before showing a single price.
 */

export const loyaltyAccountSchema = z.object({
  airline: z.string().trim().length(2).toUpperCase(),
  accountNumber: z.string().trim().min(4).max(30),
});

export type LoyaltyAccount = z.infer<typeof loyaltyAccountSchema>;

export async function getSavedLoyaltyAccounts(): Promise<LoyaltyAccount[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('loyalty_accounts')
    .eq('id', user.id)
    .maybeSingle<{ loyalty_accounts: unknown }>();

  const parsed = z.array(loyaltyAccountSchema).safeParse(data?.loyalty_accounts ?? []);
  return parsed.success ? parsed.data : [];
}

export async function saveLoyaltyAccounts(accounts: LoyaltyAccount[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('profiles')
    .update({ loyalty_accounts: accounts })
    .eq('id', user.id);
}

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'unsupported'; message: string }
  | { status: 'unavailable'; message: string };

/**
 * Sends the account to the airline for every passenger on the offer.
 *
 * Filtered against `supportedLoyaltyProgrammes` first. Duffel are explicit that
 * accounts for airlines outside that list are ignored at booking, so sending one
 * anyway would let us show "applied" for something that did nothing — a false
 * confirmation, which is worse than declining to offer it.
 */
export async function applyLoyaltyToOffer(input: {
  offerId: string;
  passengerIds: string[];
  supportedProgrammes: string[];
  account: LoyaltyAccount;
  givenName: string;
  familyName: string;
}): Promise<ApplyResult> {
  if (!input.supportedProgrammes.includes(input.account.airline)) {
    return {
      status: 'unsupported',
      message: `This fare doesn’t accept ${input.account.airline} membership numbers.`,
    };
  }

  try {
    for (const passengerId of input.passengerIds) {
      await updateOfferPassenger({
        offerId: input.offerId,
        passengerId,
        givenName: input.givenName,
        familyName: input.familyName,
        loyaltyProgrammeAccounts: [
          {
            airline_iata_code: input.account.airline,
            account_number: input.account.accountNumber,
          },
        ],
      });
    }
    return { status: 'applied' };
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'The airline wouldn’t accept that number.',
    };
  }
}
