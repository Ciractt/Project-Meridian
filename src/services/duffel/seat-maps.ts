import 'server-only';
import { duffelRequest } from './client';
import type { DuffelSeatMap } from './api-types';

/**
 * Seat maps for an offer.
 *
 * One map per segment. These are large payloads — a widebody map is thousands of
 * elements — so they are fetched only on the checkout page, never during search.
 */
export async function getSeatMaps(offerId: string): Promise<DuffelSeatMap[]> {
  return duffelRequest<DuffelSeatMap[]>({
    path: '/air/seat_maps',
    query: { offer_id: offerId },
    timeoutMs: 20_000,
  });
}
