import type {
  DuffelConditions,
  DuffelOffer,
  DuffelPlace,
  DuffelSegment,
  DuffelService,
  DuffelSlice,
} from '@/services/duffel/api-types';
import { parseIsoDuration } from '@/lib/format';
import { calculateCharge } from '@/features/booking/pricing';
import type {
  BaggageAllowance,
  BaggageService,
  FareConditions,
  Offer,
  OfferPassenger,
  Place,
  Segment,
  Slice,
} from './types';

/**
 * Combines two allowances by taking the worse of each.
 *
 * Allowance is per segment, but a traveller experiences the journey. If one leg
 * gives no checked bag, they cannot check one through — so the journey's honest
 * allowance is the minimum, not the maximum or the first.
 *
 * `unknown` is contagious on purpose: one leg we can't speak for makes the whole
 * journey one we can't speak for.
 */
function worstAllowance(a: BaggageAllowance, b: BaggageAllowance): BaggageAllowance {
  const worse = (x: number | 'unknown', y: number | 'unknown'): number | 'unknown' =>
    x === 'unknown' || y === 'unknown' ? 'unknown' : Math.min(x, y);
  return { carryOn: worse(a.carryOn, b.carryOn), checked: worse(a.checked, b.checked) };
}

const UNKNOWN_ALLOWANCE: BaggageAllowance = { carryOn: 'unknown', checked: 'unknown' };

/**
 * Folds a list of allowances to the worst of them.
 *
 * Uses an explicit empty case rather than a sentinel seed: seeding with
 * MAX_SAFE_INTEGER and folding an empty list would report a nine-quadrillion bag
 * allowance, which is the kind of value that escapes into a UI unnoticed.
 */
function foldAllowances(allowances: BaggageAllowance[]): BaggageAllowance {
  const [first, ...rest] = allowances;
  if (!first) return UNKNOWN_ALLOWANCE;
  return rest.reduce(worstAllowance, first);
}

function segmentAllowance(segment: DuffelSegment): BaggageAllowance {
  const passenger = segment.passengers?.[0];
  // No passenger fare detail, or an empty list, means the airline didn't tell
  // us. That is not the same as zero.
  if (!passenger || passenger.baggages.length === 0) return UNKNOWN_ALLOWANCE;

  let carryOn = 0;
  let checked = 0;
  for (const bag of passenger.baggages) {
    if (bag.type === 'carry_on') carryOn += bag.quantity;
    if (bag.type === 'checked') checked += bag.quantity;
  }
  return { carryOn, checked };
}

function mapConditions(conditions: DuffelConditions | null | undefined): FareConditions {
  const refund = conditions?.refund_before_departure;
  const change = conditions?.change_before_departure;
  return {
    refundable: refund ? refund.allowed : 'unknown',
    changeable: change ? change.allowed : 'unknown',
    changePenalty: change?.penalty_amount ?? null,
    changePenaltyCurrency: change?.penalty_currency ?? null,
  };
}

function mapService(service: DuffelService): BaggageService {
  return {
    id: service.id,
    kind: service.metadata?.type ?? 'unknown',
    totalAmount: service.total_amount,
    currency: service.total_currency,
    maximumQuantity: service.maximum_quantity,
    maximumWeightKg: service.metadata?.maximum_weight_kg ?? null,
    segmentIds: service.segment_ids,
    passengerIds: service.passenger_ids,
  };
}

/**
 * The supplier boundary.
 *
 * Everything Duffel-shaped stops here. Components consume our types only, so
 * adding a second supplier means writing a second file like this one rather
 * than touching the UI. This is ADR-002 made concrete.
 */

function minutesBetween(fromLocal: string, toLocal: string): number {
  // Both are local-to-airport strings without an offset. Appending Z gives a
  // consistent basis for subtraction; the result is elapsed wall-clock time,
  // which is what a layover actually is.
  return Math.round((Date.parse(`${toLocal}Z`) - Date.parse(`${fromLocal}Z`)) / 60_000);
}

function mapSegment(segment: DuffelSegment): Segment {
  const carrier = segment.marketing_carrier;
  return {
    id: segment.id,
    originCode: segment.origin.iata_code ?? '???',
    destinationCode: segment.destination.iata_code ?? '???',
    originCountry: segment.origin.iata_country_code ?? null,
    destinationCountry: segment.destination.iata_country_code ?? null,
    departingAt: segment.departing_at,
    arrivingAt: segment.arriving_at,
    durationMinutes: parseIsoDuration(segment.duration),
    marketingCarrier: carrier.name,
    marketingCarrierCode: carrier.iata_code ?? '',
    marketingCarrierLogoUrl: carrier.logo_symbol_url ?? null,
    marketingCarrierLockupUrl: carrier.logo_lockup_url ?? null,
    operatingCarrier: segment.operating_carrier.name,
    flightNumber: `${carrier.iata_code ?? ''}${segment.marketing_carrier_flight_number}`,
    aircraft: segment.aircraft?.name ?? null,
    originTerminal: segment.origin_terminal ?? null,
    destinationTerminal: segment.destination_terminal ?? null,
    technicalStops: (segment.stops ?? [])
      .map((stop) => stop.airport?.iata_code ?? null)
      .filter((code): code is string => code !== null),
  };
}

/** Exported so a Duffel *order* itinerary can be mapped, not just an offer's. */
export function mapSlice(slice: DuffelSlice): Slice {
  const segments = slice.segments.map(mapSegment);

  const layoverMinutes: number[] = [];
  for (let i = 1; i < segments.length; i++) {
    const previous = segments[i - 1];
    const current = segments[i];
    if (previous && current) {
      layoverMinutes.push(minutesBetween(previous.arrivingAt, current.departingAt));
    }
  }

  const baggage = foldAllowances(slice.segments.map(segmentAllowance));

  const leadPassenger = slice.segments[0]?.passengers?.[0];

  /* Connections between segments PLUS technical stops inside them. Counting only
     the former reports a flight that lands en route as "Direct", which is the kind
     of small invisible inaccuracy this product exists not to commit. */
  const stopCount =
    segments.length -
    1 +
    segments.reduce((total, segment) => total + segment.technicalStops.length, 0);

  return {
    id: slice.id,
    stopCount,
    fareBrandName: slice.fare_brand_name ?? null,
    cabinName: leadPassenger?.cabin_class_marketing_name ?? null,
    baggage,
    originCode: slice.origin.iata_code ?? '???',
    destinationCode: slice.destination.iata_code ?? '???',
    originName: slice.origin.city_name ?? slice.origin.name,
    destinationName: slice.destination.city_name ?? slice.destination.name,
    durationMinutes: parseIsoDuration(slice.duration),
    segments,
    layoverMinutes,
  };
}

export function mapOffer(offer: DuffelOffer): Offer {
  const slices = offer.slices.map(mapSlice);

  const hasCodeshare = slices.some((slice) =>
    slice.segments.some(
      (segment) => segment.marketingCarrier !== segment.operatingCarrier,
    ),
  );

  /* Derived once here rather than in the filter layer: mapping runs once per
     search, filtering runs on every checkbox tick. */
  const totalDurationMinutes = slices.reduce(
    (total, slice) => total + (slice.durationMinutes ?? 0),
    0,
  );
  const maxStops = slices.reduce((worst, slice) => Math.max(worst, slice.stopCount), 0);
  const journeyBaggage = foldAllowances(slices.map((slice) => slice.baggage));

  const outboundDeparture = slices[0]?.segments[0]?.departingAt;

  const passengers: OfferPassenger[] = (offer.passengers ?? []).map((passenger) => ({
    id: passenger.id,
    type: passenger.type ?? 'adult',
  }));

  /* The all-in price is computed HERE, once, at the supplier boundary — not at
     checkout. Everything downstream (cards, filters, ranking, the summary strip)
     then works on the figure the customer actually pays, and there is no point in
     the funnel where the number can change. Same function runs again at
     checkout, so the two cannot disagree. */
  const charge = calculateCharge(offer.total_amount, offer.total_currency);

  return {
    id: offer.id,
    totalAmount: charge.chargeAmount,
    totalAmountValue: Number(charge.chargeAmount),
    supplierAmount: charge.fareAmount,
    feeAmount: (Number(charge.chargeAmount) - Number(charge.fareAmount)).toFixed(2),
    baseAmount: offer.base_amount,
    taxAmount: offer.tax_amount,
    currency: offer.total_currency,
    expiresAt: offer.expires_at,
    airline: offer.owner.name,
    airlineCode: offer.owner.iata_code ?? '',
    airlineLogoUrl: offer.owner.logo_lockup_url ?? offer.owner.logo_symbol_url ?? null,
    slices,
    passengers,
    hasCodeshare,
    identityDocumentsRequired: offer.passenger_identity_documents_required ?? false,
    baggage: journeyBaggage,
    conditions: mapConditions(offer.conditions),
    emissionsKg: offer.total_emissions_kg ?? null,
    supportedLoyaltyProgrammes: offer.supported_loyalty_programmes ?? [],
    conditionsOfCarriageUrl: offer.owner.conditions_of_carriage_url ?? null,
    availableServices: (offer.available_services ?? []).map(mapService),
    totalDurationMinutes,
    maxStops,
    outboundDepartureHour: outboundDeparture
      ? Number(outboundDeparture.slice(11, 13))
      : 0,
  };
}

export function mapPlace(place: DuffelPlace): Place | null {
  if (!place.iata_code) return null;
  return {
    iataCode: place.iata_code,
    name: place.name,
    city: place.city_name ?? place.name,
    countryCode: place.iata_country_code ?? '',
    isCity: place.type === 'city',
  };
}
