import { z } from 'zod';

/**
 * Validation lives here and is shared by the client form and the server route.
 * The browser copy is a courtesy; the server copy is the one that counts.
 * Never trust a search URL a user can hand-edit.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker to choose a date.');

/** Today in the traveller's local timezone, as a calendar date string. */
export function today(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export const cabinClasses = [
  'economy',
  'premium_economy',
  'business',
  'first',
] as const;

export const flightSearchSchema = z
  .object({
    tripType: z.enum(['return', 'one-way']).default('return'),
    origin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Choose a departure airport.'),
    destination: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Choose a destination airport.'),
    departureDate: isoDate,
    returnDate: isoDate.optional(),
    adults: z.coerce.number().int().min(1).max(9),
    /**
     * Ages of accompanying children, as a comma-separated list — "4,9,1".
     *
     * Ages rather than adult/child/infant counts because airlines disagree about
     * the bands: one carrier treats a 14-year-old as an adult, another as a young
     * adult. Sending a band makes that judgement on the airline's behalf, and
     * getting it wrong produces a rejected order AFTER the card has been charged.
     * Sending the age lets each airline apply its own rules.
     */
    childAges: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .map(Number),
      )
      .refine(
        (ages) => ages.every((age) => Number.isInteger(age) && age >= 0 && age <= 17),
        'Children must be aged 0 to 17.',
      )
      .refine((ages) => ages.length <= 8, 'Up to 8 children per search.'),
    cabin: z.enum(cabinClasses).default('economy'),
    // Kept as a string rather than z.coerce.boolean(), which would turn the
    // string "false" into true. URL params are always strings.
    direct: z.enum(['true', 'false']).default('false'),
  })
  .check((ctx) => {
    const v = ctx.value;

    if (v.origin === v.destination) {
      ctx.issues.push({
        code: 'custom',
        message: 'Departure and destination must be different airports.',
        path: ['destination'],
        input: v.destination,
      });
    }

    if (v.departureDate < today()) {
      ctx.issues.push({
        code: 'custom',
        message: 'Choose a departure date from today onwards.',
        path: ['departureDate'],
        input: v.departureDate,
      });
    }

    if (v.tripType === 'return') {
      if (!v.returnDate) {
        ctx.issues.push({
          code: 'custom',
          message: 'Choose a return date, or switch to one way.',
          path: ['returnDate'],
          input: v.returnDate,
        });
      } else if (v.returnDate < v.departureDate) {
        ctx.issues.push({
          code: 'custom',
          message: 'The return date cannot be before the departure date.',
          path: ['returnDate'],
          input: v.returnDate,
        });
      }
    }

    /* Airline booking engines cap a single itinerary at nine seats. Under-2s
       travel on a lap and don't occupy one, so they're excluded from the count —
       but each still needs an adult to sit with. */
    const lapInfants = v.childAges.filter((age) => age < 2).length;
    const seated = v.adults + v.childAges.length - lapInfants;

    if (seated > 9) {
      ctx.issues.push({
        code: 'custom',
        message: 'Up to 9 travellers per search, not counting lap infants.',
        path: ['adults'],
        input: v.adults,
      });
    }

    if (lapInfants > v.adults) {
      ctx.issues.push({
        code: 'custom',
        message: 'Each infant under 2 must travel with an adult.',
        path: ['childAges'],
        input: v.childAges,
      });
    }
  });

export type FlightSearchInput = z.input<typeof flightSearchSchema>;
export type FlightSearchParams = z.output<typeof flightSearchSchema>;

/** Serialise criteria into the shareable URL that /search reads. */
export function toSearchParams(params: FlightSearchParams): URLSearchParams {
  const sp = new URLSearchParams({
    tripType: params.tripType,
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    adults: String(params.adults),
    childAges: params.childAges.join(','),
    cabin: params.cabin,
    direct: params.direct,
  });
  if (params.tripType === 'return' && params.returnDate) {
    sp.set('returnDate', params.returnDate);
  }
  return sp;
}


/** Total travellers, including lap infants. */
export function travellerCount(params: FlightSearchParams): number {
  return params.adults + params.childAges.length;
}
