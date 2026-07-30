import 'server-only';
import { getOffer } from '@/services/duffel/flights';
import { DuffelRequestError, DuffelUnavailableError } from '@/services/duffel/errors';
import { mapOffer } from '@/features/flight-search/map';
import type { Offer } from '@/features/flight-search/types';

export type RepriceResult =
  | { status: 'ok'; offer: Offer; changed: false }
  | { status: 'ok'; offer: Offer; changed: true; previousAmount: string }
  | { status: 'expired' }
  | { status: 'unavailable'; message: string };

/**
 * Re-read the offer immediately before showing a final price or taking money.
 *
 * This is not optional and it is not a nicety. Airline revenue management moves
 * fares continuously, and our own search cache can serve a price up to ten
 * minutes old. The offer we displayed is a quote with a shelf life; the offer
 * we charge against must be the live one.
 *
 * Skipping this is how an OTA sells below cost, or takes a payment that the
 * airline then refuses to ticket.
 *
 * `shownAmount` is only used to decide whether to tell the traveller the price
 * moved. The authoritative figure is always the one Duffel just returned, so a
 * tampered value cannot change what we charge.
 */
export async function repriceOffer(
  offerId: string,
  shownAmount?: string,
): Promise<RepriceResult> {
  try {
    const offer = mapOffer(await getOffer(offerId));

    if (Date.parse(offer.expiresAt) <= Date.now()) return { status: 'expired' };

    if (shownAmount && Number(shownAmount) !== offer.totalAmountValue) {
      return { status: 'ok', offer, changed: true, previousAmount: shownAmount };
    }
    return { status: 'ok', offer, changed: false };
  } catch (error) {
    if (error instanceof DuffelRequestError) {
      // 404 and 422 both mean "this offer can no longer be used", which for a
      // traveller is the same thing: search again.
      if (error.status === 404 || error.status === 422) return { status: 'expired' };
      return { status: 'unavailable', message: error.message };
    }
    if (error instanceof DuffelUnavailableError) {
      return { status: 'unavailable', message: error.message };
    }
    throw error;
  }
}
