/**
 * IATA SSR codes, with what they actually mean to a traveller.
 *
 * Its own module because both a server module and a client component need it,
 * and `assistance.ts` is `server-only` — importing it into the checkout form
 * would pull the service-role client into the browser bundle, which is the
 * failure that directive exists to catch.
 *
 * The codes are what an airline understands. The labels are what a traveller
 * understands. Both are needed and they are not the same sentence.
 */
export const ASSISTANCE_OPTIONS = [
  {
    code: 'WCHR',
    label: 'Wheelchair to the aircraft door',
    detail: 'You can manage steps and walk to your seat, but not long distances.',
  },
  {
    code: 'WCHS',
    label: 'Wheelchair, and help with steps',
    detail: 'You can walk to your seat but cannot manage stairs.',
  },
  {
    code: 'WCHC',
    label: 'Wheelchair all the way to the seat',
    detail: 'You cannot walk any distance and need help boarding.',
  },
  { code: 'BLND', label: 'Help for a blind or partially sighted traveller' },
  { code: 'DEAF', label: 'Help for a deaf or hard-of-hearing traveller' },
  {
    code: 'DPNA',
    label: 'Help for a traveller with a learning or cognitive disability',
  },
] as const;

export type AssistanceCode = (typeof ASSISTANCE_OPTIONS)[number]['code'];
