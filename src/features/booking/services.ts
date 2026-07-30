import 'server-only';
import { getOffer } from '@/services/duffel/flights';
import { getSeatMaps } from '@/services/duffel/seat-maps';
import type { DuffelSeatMap } from '@/services/duffel/api-types';

/**
 * Server-side validation of selected extras.
 *
 * The browser tells us which service IDs the traveller picked. It must never tell
 * us what they cost. Duffel's ancillaries component runs in the page, so a
 * crafted request could otherwise claim a £60 checked bag costs a penny — and the
 * airline would still take £60 from our balance.
 *
 * So: re-fetch the authoritative prices, look each selected ID up, and compute
 * the total ourselves. Anything we can't find is rejected outright rather than
 * priced at zero.
 *
 * Two sources have to be walked, which is easy to get wrong: baggage lives in the
 * offer's `available_services`, seats live in the seat maps. A validator that
 * only checks the first silently accepts any seat price it is handed.
 */

export interface SelectedService {
  id: string;
  quantity: number;
}

export interface ValidatedServices {
  services: SelectedService[];
  /** Total owed to the airline for extras, in the offer's currency. */
  totalAmount: string;
  currency: string;
}

export type ServiceValidation =
  | { status: 'ok'; result: ValidatedServices }
  | { status: 'invalid'; message: string };

interface PriceEntry {
  amount: number;
  currency: string;
  maximumQuantity: number;
}

function collectSeatPrices(
  seatMaps: DuffelSeatMap[],
  into: Map<string, PriceEntry>,
): void {
  for (const map of seatMaps) {
    for (const cabin of map.cabins) {
      for (const row of cabin.rows) {
        for (const section of row.sections) {
          for (const element of section.elements) {
            for (const service of element.available_services ?? []) {
              into.set(service.id, {
                amount: Number(service.total_amount),
                currency: service.total_currency,
                // A seat is a seat. You cannot buy 14C twice.
                maximumQuantity: 1,
              });
            }
          }
        }
      }
    }
  }
}

export async function validateSelectedServices(
  offerId: string,
  selected: SelectedService[],
): Promise<ServiceValidation> {
  if (selected.length === 0) {
    // No extras chosen. Nothing to price, and no reason to spend two API calls.
    return {
      status: 'ok',
      result: { services: [], totalAmount: '0.00', currency: 'GBP' },
    };
  }

  const prices = new Map<string, PriceEntry>();

  const offer = await getOffer(offerId);
  for (const service of offer.available_services ?? []) {
    prices.set(service.id, {
      amount: Number(service.total_amount),
      currency: service.total_currency,
      maximumQuantity: service.maximum_quantity,
    });
  }

  // Only fetch seat maps if something selected isn't already accounted for —
  // widebody maps are large and most bookings add bags only.
  if (selected.some((service) => !prices.has(service.id))) {
    try {
      collectSeatPrices(await getSeatMaps(offerId), prices);
    } catch (error) {
      console.error('Could not load seat maps for validation:', error);
    }
  }

  let total = 0;
  let currency = offer.total_currency;

  for (const choice of selected) {
    const price = prices.get(choice.id);
    if (!price) {
      return {
        status: 'invalid',
        message: 'One of the extras you chose is no longer available.',
      };
    }
    if (!Number.isFinite(price.amount)) {
      return { status: 'invalid', message: 'We couldn’t price one of your extras.' };
    }
    if (choice.quantity < 1 || choice.quantity > price.maximumQuantity) {
      return {
        status: 'invalid',
        message: 'One of the extras you chose isn’t available in that quantity.',
      };
    }
    // Mixed currencies would make the sum meaningless rather than merely wrong.
    if (price.currency !== currency) {
      return {
        status: 'invalid',
        message: 'We can’t combine these extras in one payment.',
      };
    }
    total += price.amount * choice.quantity;
    currency = price.currency;
  }

  return {
    status: 'ok',
    result: {
      services: selected,
      totalAmount: total.toFixed(2),
      currency,
    },
  };
}
