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
    children: z.coerce.number().int().min(0).max(8),
    infants: z.coerce.number().int().min(0).max(8),
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

    // Airline booking engines cap a single itinerary at nine seats. Infants on
    // laps are not seats, but each needs an accompanying adult.
    if (v.adults + v.children > 9) {
      ctx.issues.push({
        code: 'custom',
        message: 'Up to 9 travellers per search, not counting lap infants.',
        path: ['adults'],
        input: v.adults,
      });
    }

    if (v.infants > v.adults) {
      ctx.issues.push({
        code: 'custom',
        message: 'Each infant must travel with an adult.',
        path: ['infants'],
        input: v.infants,
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
    children: String(params.children),
    infants: String(params.infants),
    cabin: params.cabin,
    direct: params.direct,
  });
  if (params.tripType === 'return' && params.returnDate) {
    sp.set('returnDate', params.returnDate);
  }
  return sp;
}
