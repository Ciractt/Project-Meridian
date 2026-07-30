/**
 * Domain types for flight search.
 *
 * These are OUR types, not Duffel's. `features/flight-search/map.ts` converts
 * Duffel responses into these shapes. That indirection is the most valuable
 * thing in this file: swapping or adding a supplier touches one adapter rather
 * than every component in the app.
 */

export type TripType = 'return' | 'one-way';

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface Place {
  /** Three-letter IATA code, uppercase. */
  iataCode: string;
  /** Airport or city name as shown to travellers. */
  name: string;
  city: string;
  countryCode: string;
  /** True for metropolitan area codes such as LON or NYC. */
  isCity?: boolean;
}

/**
 * Who is travelling.
 *
 * Adults as a count, everyone under 18 as an age. Airlines disagree about where
 * childhood ends — one treats a 14-year-old as an adult, another as a young adult
 * — so sending a band makes that judgement on their behalf, and getting it wrong
 * produces an order rejected after the card has been charged. The age lets each
 * airline apply its own rules.
 */
export interface PassengerSelection {
  adults: number;
  /** Age on the date of travel. Under 2 travels on a lap. */
  childAges: number[];
}

export interface FlightSearchCriteria {
  tripType: TripType;
  origin: string;
  destination: string;
  /** ISO 8601 calendar date. Never a Date object: dates here are calendar
   *  dates in the airport's local time, not instants. */
  departureDate: string;
  returnDate?: string;
  passengers: PassengerSelection;
  cabin: CabinClass;
}

/* ---- Results ---- */

export interface Segment {
  id: string;
  originCode: string;
  destinationCode: string;
  /** ISO 3166-1 alpha-2. Needed to reason about border crossings. */
  originCountry: string | null;
  destinationCountry: string | null;
  /** Local to the airport, no timezone offset. */
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
  /** Whose flight number is on the ticket. */
  marketingCarrier: string;
  marketingCarrierCode: string;
  /** Logomark only. */
  marketingCarrierLogoUrl: string | null;
  /** Logomark plus wordmark — the one to use on a card. */
  marketingCarrierLockupUrl: string | null;
  /** Who actually flies the aircraft. Must be shown to the traveller. */
  operatingCarrier: string;
  flightNumber: string;
  aircraft: string | null;
  originTerminal: string | null;
  destinationTerminal: string | null;
  /**
   * Intermediate stops within this segment. Same flight number, aircraft lands,
   * passengers usually stay aboard — but it is not a direct flight and must not
   * be described as one.
   */
  technicalStops: string[];
}

/**
 * What the fare actually includes.
 *
 * `unknown` is a distinct state and not a synonym for zero. Some airlines return
 * an empty baggage array meaning "we haven't told you", and rendering that as
 * "no bags included" would be a false claim about a product someone is buying.
 * When we don't know, we say we don't know.
 */
export interface BaggageAllowance {
  carryOn: number | 'unknown';
  checked: number | 'unknown';
}

export interface FareConditions {
  refundable: boolean | 'unknown';
  changeable: boolean | 'unknown';
  changePenalty: string | null;
  changePenaltyCurrency: string | null;
}

export interface Slice {
  id: string;
  originCode: string;
  destinationCode: string;
  originName: string;
  destinationName: string;
  durationMinutes: number | null;
  segments: Segment[];
  /** Ground time between segments, in minutes, in order. */
  layoverMinutes: number[];
  /**
   * Every stop on this leg: connections between segments plus technical stops
   * within them. This is the number a traveller means by "how many stops".
   */
  stopCount: number;
  /** Airline's fare family name, e.g. "Economy Basic". */
  fareBrandName: string | null;
  /** Cabin as the airline markets it, which can differ from the cabin class. */
  cabinName: string | null;
  /** Worst allowance across this slice's segments — see BaggageAllowance. */
  baggage: BaggageAllowance;
}

export interface OfferPassenger {
  /** Duffel's ID from the offer request. Order creation must reuse it exactly. */
  id: string;
  type: 'adult' | 'child' | 'infant_without_seat';
}

export interface Offer {
  id: string;

  /**
   * What the customer pays. Fare, taxes, our fee and card processing — the
   * all-in figure, computed once at the mapping boundary.
   *
   * This is deliberately the field named `totalAmount`, so that anything
   * rendering "the price" renders the price someone actually pays. An earlier
   * version put Duffel's fare here and added our fee at checkout, which meant
   * search results advertised a number £30 below the one on the card form. That
   * is drip pricing, and it was ours.
   */
  totalAmount: string;
  /** Same value as a number, for sorting and filtering only. Never displayed —
   *  float rounding has no business near a customer-facing price. */
  totalAmountValue: number;

  /** What the airline charges. Paid from our Duffel balance, never displayed as
   *  "the price". */
  supplierAmount: string;
  /** totalAmount less supplierAmount: our margin plus recovered card costs.
   *  Itemised on the card, because a fee you won't name isn't transparency. */
  feeAmount: string;

  /** Duffel's own split of the supplier amount. */
  baseAmount: string | null;
  taxAmount: string | null;
  currency: string;
  /** After this the offer cannot be booked and must be re-priced. */
  expiresAt: string;
  airline: string;
  airlineCode: string;
  airlineLogoUrl: string | null;
  slices: Slice[];
  /** Who this offer was priced for. Order creation must echo these IDs. */
  passengers: OfferPassenger[];
  /** True when marketing and operating carrier differ on any segment. */
  hasCodeshare: boolean;
  /**
   * The airline requires passport or ID details at the time of booking.
   * Most short-haul European fares do not; many long-haul and US-bound ones do.
   * We collect documents only when this is true — asking for a passport number
   * that nobody needs is data we then have to protect for no reason.
   */
  identityDocumentsRequired: boolean;

  /* Derived once at the mapping boundary so filtering and ranking never
     recompute them per keystroke. */
  totalDurationMinutes: number;
  /** Worst stop count across all slices — the leg with the most connections
   *  is what a traveller actually reacts to. */
  maxStops: number;
  /** Local hour of the outbound departure, for the time-of-day filter. */
  outboundDepartureHour: number;
  /** Worst allowance across the whole journey. */
  baggage: BaggageAllowance;
  conditions: FareConditions;
  /** Estimated CO2 for the itinerary, kilograms. */
  emissionsKg: string | null;
  /** The airline's own conditions of carriage — the contract the traveller is
   *  actually entering into. Almost no comparison site links to it. */
  conditionsOfCarriageUrl: string | null;
  /** Sellable extras. Empty unless this offer came from the single-offer
   *  endpoint, which is the only one that returns them. */
  availableServices: BaggageService[];
}

export interface BaggageService {
  id: string;
  kind: 'checked' | 'carry_on' | 'unknown';
  totalAmount: string;
  currency: string;
  maximumQuantity: number;
  maximumWeightKg: number | null;
  segmentIds: string[];
  passengerIds: string[];
}
