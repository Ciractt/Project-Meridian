/**
 * The subset of Duffel's API shapes we actually consume.
 *
 * Hand-written rather than generated because Duffel returns a great deal we
 * don't use, and typing only what we read makes it obvious when the mapping
 * layer starts depending on something new. These types stop at the service
 * boundary — nothing outside src/services/duffel should import them.
 */

export interface DuffelPlace {
  id: string;
  type: 'airport' | 'city';
  name: string;
  iata_code: string | null;
  iata_city_code?: string | null;
  iata_country_code: string | null;
  city_name?: string | null;
  time_zone?: string | null;
}

export interface DuffelCarrier {
  id: string;
  name: string;
  /** Link to the airline's own conditions of carriage — the actual contract. */
  conditions_of_carriage_url?: string | null;
  iata_code: string | null;
  /** Logomark only. Null when Duffel has no artwork for the carrier. */
  logo_symbol_url?: string | null;
  /** Logotype plus mark. */
  logo_lockup_url?: string | null;
}

export interface DuffelBaggage {
  type: 'carry_on' | 'checked';
  quantity: number;
}

export interface DuffelSegmentPassenger {
  passenger_id: string;
  cabin_class: 'economy' | 'premium_economy' | 'business' | 'first';
  /** The airline's own name for the fare, e.g. "Economy Basic". */
  cabin_class_marketing_name: string | null;
  baggages: DuffelBaggage[];
  fare_basis_code: string | null;
}

export interface DuffelSegment {
  id: string;
  origin: DuffelPlace;
  destination: DuffelPlace;
  /** ISO 8601 local datetime, no offset. Local to the airport. */
  departing_at: string;
  arriving_at: string;
  /** ISO 8601 duration, e.g. "PT7H25M". */
  duration: string | null;
  marketing_carrier: DuffelCarrier;
  operating_carrier: DuffelCarrier;
  marketing_carrier_flight_number: string;
  aircraft: { name: string } | null;
  /** Per-passenger fare detail, including baggage allowance for THIS segment. */
  passengers?: DuffelSegmentPassenger[];
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  /**
   * Intermediate stops WITHIN this segment — the aircraft lands, passengers stay
   * aboard, same flight number. Counting stops as `segments.length - 1` ignores
   * these and reports such a flight as direct, which it is not.
   */
  stops?: Array<{
    id: string;
    airport?: DuffelPlace;
    departing_at?: string;
    arriving_at?: string;
    duration?: string | null;
  }> | null;
}

export interface DuffelSlice {
  id: string;
  origin: DuffelPlace;
  destination: DuffelPlace;
  duration: string | null;
  segments: DuffelSegment[];
  /** Airline's fare family name for this slice, e.g. "Economy Flex". */
  fare_brand_name?: string | null;
}

export interface DuffelCondition {
  allowed: boolean;
  penalty_amount: string | null;
  penalty_currency: string | null;
}

export interface DuffelConditions {
  refund_before_departure: DuffelCondition | null;
  change_before_departure: DuffelCondition | null;
}

/**
 * Sellable extras — bags today, more later.
 *
 * Only returned by the single-offer endpoint, never in a list. So the results
 * page cannot know what a bag costs, but the review page can.
 */
export interface DuffelService {
  id: string;
  type: 'baggage';
  total_amount: string;
  total_currency: string;
  maximum_quantity: number;
  segment_ids: string[];
  passenger_ids: string[];
  metadata: {
    type?: 'checked' | 'carry_on';
    maximum_weight_kg?: number | null;
    maximum_height_cm?: number | null;
    maximum_length_cm?: number | null;
    maximum_depth_cm?: number | null;
  };
}

export interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  base_amount: string | null;
  tax_amount: string | null;
  /** After this, the offer cannot be used to create an order. */
  expires_at: string;
  owner: DuffelCarrier;
  slices: DuffelSlice[];
  passenger_identity_documents_required: boolean;
  live_mode: boolean;
  /** Estimated CO2 for the whole itinerary. */
  total_emissions_kg?: string | null;
  /** Order passenger IDs must match these. */
  passengers?: DuffelOfferPassenger[];
  conditions?: DuffelConditions | null;
  /** Present only on the Get-single-offer response. */
  available_services?: DuffelService[] | null;
}

export interface DuffelOfferRequest {
  id: string;
  live_mode: boolean;
  created_at: string;
}

export type DuffelPassengerType = 'adult' | 'child' | 'infant_without_seat';

/* ---- Orders ---- */

export type DuffelPassengerTitle = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';

export interface DuffelOrderPassengerInput {
  /** Must match the offer's passenger IDs, in the same roles. */
  id: string;
  title: DuffelPassengerTitle;
  given_name: string;
  family_name: string;
  /** ISO calendar date. */
  born_on: string;
  gender: 'm' | 'f';
  email: string;
  /** E.164, e.g. +447700900123. */
  phone_number: string;
  identity_documents?: Array<{
    type: 'passport';
    unique_identifier: string;
    issuing_country_code: string;
    expires_on: string;
  }>;
}

export interface DuffelOrder {
  id: string;
  booking_reference: string | null;
  total_amount: string;
  total_currency: string;
  live_mode: boolean;
  created_at: string;
  owner: DuffelCarrier;
  slices: DuffelSlice[];
  passengers: Array<{ id: string; given_name: string; family_name: string }>;
}

/** The offer's own passenger list — needed because order passenger IDs must
 *  match the ones the offer request generated. */
export interface DuffelOfferPassenger {
  id: string;
  type?: 'adult' | 'child' | 'infant_without_seat';
  age?: number;
}

/* ---- Seat maps ---- */

/**
 * Minimal seat map subset.
 *
 * Only what we need to (a) hand the map to Duffel's component and (b) validate a
 * selected seat service against real prices. Seat services do NOT appear in an
 * offer's `available_services` — they live here — so validating a booking's
 * extras means walking both sources.
 */
export interface DuffelSeatService {
  id: string;
  passenger_id: string;
  total_amount: string;
  total_currency: string;
}

export interface DuffelSeatElement {
  type: string;
  designator?: string;
  available_services?: DuffelSeatService[];
}

export interface DuffelSeatMap {
  id: string;
  segment_id: string;
  slice_id: string;
  cabins: Array<{
    rows: Array<{
      sections: Array<{
        elements: DuffelSeatElement[];
      }>;
    }>;
  }>;
}
