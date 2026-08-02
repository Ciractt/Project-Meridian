import { z } from 'zod';
import { todayKey } from '@/lib/date';

/** Alias so the identity-document check reads naturally. */
const today = todayKey;

/**
 * Passenger details, validated to airline requirements.
 *
 * The rules here aren't arbitrary form hygiene — a name that doesn't match the
 * travel document means denied boarding, and correcting a name after ticketing
 * costs a fee or a full reissue. Getting this right at the form is far cheaper
 * than getting it wrong at the airport.
 */

const NAME_PATTERN = /^[A-Za-z\u00C0-\u024F' -]+$/;

const name = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${field} exactly as it appears on the passport.`)
    .max(60, 'That name is too long for airline systems.')
    .regex(
      NAME_PATTERN,
      'Use only letters, hyphens and apostrophes — no initials or titles.',
    );

/** E.164. Airlines use this to reach travellers about disruption, so a wrong
 *  number is a real operational problem, not a validation nicety. */
const phone = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{6,14}$/,
    'Include the country code, e.g. +447700900123.',
  );

export const passengerSchema = z
  .object({
    /** Duffel's passenger ID from the offer. Not user input — carried through. */
    id: z.string().min(1),
    type: z.enum(['adult', 'child', 'infant_without_seat']),
    title: z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']),
    givenName: name('first name'),
    familyName: name('last name'),
    bornOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth.'),
    /**
     * Duffel exposes a binary field because airline and GDS systems do. We ask
     * for what is printed on the travel document rather than how someone
     * identifies, because that is what has to match at the gate — and we label
     * the field that way in the UI.
     */
    gender: z.enum(['m', 'f']),
    /**
     * Only collected when the offer says the airline needs it. Passed straight
     * through to Duffel and never written to our database — see ADR-018.
     */
    passportNumber: z.string().trim().max(20).optional(),
    passportCountry: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Use the two-letter country code, e.g. GB.')
      .optional(),
    passportExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the expiry date.')
      .optional(),
    /**
     * Airport assistance, if this traveller asked for it.
     *
     * Optional and never validated into a failure: a malformed assistance
     * request must not stop a booking. It is recorded after the order exists
     * and passed to the airline by hand — Duffel cannot carry it (ADR-048).
     */
    assistance: z
      .object({
        codes: z.array(z.string().max(8)).max(6).default([]),
        notes: z.string().trim().max(1000).optional(),
      })
      .optional(),
  })
  .check((ctx) => {
    const value = ctx.value;

    if (value.bornOn >= todayKey()) {
      ctx.issues.push({
        code: 'custom',
        message: 'Date of birth must be in the past.',
        path: ['bornOn'],
        input: value.bornOn,
      });
      return;
    }

    // Age bands must match what was searched, or the airline rejects the order
    // and the traveller has already given us their card details.
    const age = ageOn(value.bornOn, todayKey());

    if (value.type === 'adult' && age < 12) {
      ctx.issues.push({
        code: 'custom',
        message: 'This traveller was booked as an adult but is under 12.',
        path: ['bornOn'],
        input: value.bornOn,
      });
    }
    if (value.type === 'child' && (age < 2 || age >= 12)) {
      ctx.issues.push({
        code: 'custom',
        message: 'Children must be aged 2 to 11 on the date of travel.',
        path: ['bornOn'],
        input: value.bornOn,
      });
    }
    if (value.type === 'infant_without_seat' && age >= 2) {
      ctx.issues.push({
        code: 'custom',
        message: 'Infants must be under 2. Book this traveller as a child.',
        path: ['bornOn'],
        input: value.bornOn,
      });
    }
  });

export const contactSchema = z.object({
  email: z.string().trim().email('Enter an email we can send the ticket to.'),
  phoneNumber: phone,
});

/**
 * Passport details, checked only when the airline requires them.
 *
 * Built as a separate refinement rather than baked into `passengerSchema` so the
 * same schema serves both cases. Which case applies is decided by the offer, on
 * the server — never by the client.
 */
export function requireIdentityDocuments(passengers: PassengerInput[]): Record<
  string,
  string
> {
  const errors: Record<string, string> = {};
  passengers.forEach((passenger, index) => {
    const prefix = `passengers.${index}`;
    if (!passenger.passportNumber) {
      errors[`${prefix}.passportNumber`] = 'This airline needs the passport number.';
    }
    if (!passenger.passportCountry) {
      errors[`${prefix}.passportCountry`] = 'Enter the issuing country code.';
    }
    if (!passenger.passportExpiry) {
      errors[`${prefix}.passportExpiry`] = 'Enter the passport expiry date.';
    } else if (passenger.passportExpiry <= today()) {
      errors[`${prefix}.passportExpiry`] = 'This passport has expired.';
    }
  });
  return errors;
}

/**
 * Selected extras.
 *
 * IDs and quantities only — deliberately no prices. The browser chooses what;
 * the server decides what it costs. See features/booking/services.ts.
 */
export const selectedServiceSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(9),
});

/**
 * Optionally open an account with the same booking.
 *
 * A password and nothing else — the email is already being collected for the
 * ticket, and asking for it twice mid-checkout to sign someone up would be
 * asking them to type an address they can already see on the screen.
 *
 * `.optional()` throughout: this is never required to book, and a validation
 * error here must never be able to stop a booking. The server treats a bad
 * password as "don't create an account" rather than as a form failure.
 */
export const accountSignupSchema = z.object({
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'That password is too long.'),
});

export const bookingSchema = z.object({
  offerId: z.string().min(1),
  /** Client-generated, so a retry or double-click cannot book twice. */
  attemptToken: z.string().uuid(),
  contact: contactSchema,
  passengers: z.array(passengerSchema).min(1).max(9),
  services: z.array(selectedServiceSchema).max(40).default([]),
});

export type PassengerInput = z.infer<typeof passengerSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;

/** Whole years between two calendar dates. */
export function ageOn(bornOn: string, onDate: string): number {
  const [by, bm, bd] = bornOn.split('-').map(Number);
  const [oy, om, od] = onDate.split('-').map(Number);
  let age = (oy ?? 0) - (by ?? 0);
  if ((om ?? 0) < (bm ?? 0) || ((om ?? 0) === (bm ?? 0) && (od ?? 0) < (bd ?? 0))) {
    age -= 1;
  }
  return age;
}
