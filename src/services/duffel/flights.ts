import 'server-only';
import { duffelRequest } from './client';
import type {
  DuffelOffer,
  DuffelOfferRequest,
  DuffelPassengerType,
  DuffelPlace,
} from './api-types';

/**
 * Search is two calls, not one.
 *
 * We create the offer request with `return_offers=false`, then read offers
 * from the List Offers endpoint. Duffel's own guidance is to do it this way
 * when you want pagination, sorting and filtering — which a results page
 * always does. The alternative (return_offers=true) hands back every offer in
 * one payload and leaves us sorting hundreds of results in application code.
 */

interface SearchInput {
  slices: Array<{ origin: string; destination: string; departureDate: string }>;
  passengers: { adults: number; childAges: number[] };
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  maxConnections?: number;
}

export type OfferSort = 'total_amount' | 'total_duration';

/** Below the client's 30s abort so Duffel returns partial results rather than
 *  us timing out with nothing. */
const SUPPLIER_TIMEOUT_MS = 18_000;

/**
 * Adults by type, children by age.
 *
 * Duffel accepts `age` OR `type` per passenger, never both. Age is the more
 * correct input for anyone under 18: airlines disagree about where childhood
 * ends, and sending a band makes that call for them — which surfaces as a
 * rejected order after the traveller has paid. Sending the age lets each airline
 * apply its own rules and tells us what it decided in the offer's passenger list.
 *
 * Adults stay as a type because we don't ask adults their age and there is no
 * airline disagreement to resolve above 18.
 */
function buildPassengers(counts: SearchInput['passengers']) {
  const passengers: Array<{ type: DuffelPassengerType } | { age: number }> = [];
  for (let i = 0; i < counts.adults; i++) passengers.push({ type: 'adult' });
  for (const age of counts.childAges) passengers.push({ age });
  return passengers;
}

export async function createOfferRequest(
  input: SearchInput,
): Promise<DuffelOfferRequest> {
  return duffelRequest<DuffelOfferRequest>({
    method: 'POST',
    path: '/air/offer_requests',
    query: { return_offers: false, supplier_timeout: SUPPLIER_TIMEOUT_MS },
    body: {
      data: {
        slices: input.slices.map((slice) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_date: slice.departureDate,
        })),
        passengers: buildPassengers(input.passengers),
        cabin_class: input.cabin,
        max_connections: input.maxConnections ?? 1,
      },
    },
  });
}

export async function listOffers(
  offerRequestId: string,
  options: { sort?: OfferSort; limit?: number } = {},
): Promise<DuffelOffer[]> {
  return duffelRequest<DuffelOffer[]>({
    path: '/air/offers',
    query: {
      offer_request_id: offerRequestId,
      sort: options.sort ?? 'total_amount',
      limit: options.limit ?? 50,
    },
  });
}

/**
 * Re-read a single offer immediately before showing a final price or taking
 * payment. Airline revenue management moves fares between search and book, so
 * the offer you displayed is a quote with a shelf life, not a price.
 */
export async function getOffer(offerId: string): Promise<DuffelOffer> {
  return duffelRequest<DuffelOffer>({
    path: `/air/offers/${offerId}`,
    // Without this, `available_services` comes back empty and the checkout
    // silently decides the airline sells no bags — which is how the extras step
    // ended up being skipped on every booking.
    query: { return_available_services: true },
  });
}

/**
 * The offer exactly as Duffel returned it.
 *
 * Duffel's own ancillaries component takes their `Offer` type, not ours, so this
 * is a deliberate and bounded hole in the supplier boundary (ADR-002): the raw
 * payload travels straight to that one component and nowhere else. Everything
 * our own code reads still goes through `mapOffer`.
 */
export async function getRawOffer(offerId: string): Promise<unknown> {
  return duffelRequest<unknown>({
    path: `/air/offers/${offerId}`,
    query: { return_available_services: true },
  });
}

export async function searchPlaces(query: string): Promise<DuffelPlace[]> {
  return duffelRequest<DuffelPlace[]>({
    path: '/places/suggestions',
    // `query`, not `name`. Duffel deprecated `name` and it now returns a
    // deprecation warning rather than results — which is why airport search was
    // silently falling back to the bundled list for everything outside it.
    query: { query },
    timeoutMs: 5_000,
  });
}


/**
 * Attach a loyalty programme account to a passenger on an existing offer.
 *
 * The alternative is collecting frequent-flyer numbers at search time, which
 * airlines only accept alongside the traveller's name — so it would mean asking
 * for names before showing a single price. Doing it here instead means the search
 * form stays as it is and the number is asked for at the point it can be used.
 *
 * The offer must be re-read afterwards: the airline may change the price, the
 * baggage allowance or the seat entitlement in response, and that is the entire
 * point of sending it.
 */
export async function updateOfferPassenger(input: {
  offerId: string;
  passengerId: string;
  givenName: string;
  familyName: string;
  loyaltyProgrammeAccounts: Array<{
    airline_iata_code: string;
    account_number: string;
  }>;
}): Promise<void> {
  await duffelRequest<unknown>({
    method: 'PATCH',
    path: `/air/offers/${input.offerId}/passengers/${input.passengerId}`,
    timeoutMs: 30_000,
    body: {
      data: {
        given_name: input.givenName,
        family_name: input.familyName,
        loyalty_programme_accounts: input.loyaltyProgrammeAccounts,
      },
    },
  });
}
