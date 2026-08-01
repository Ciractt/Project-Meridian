import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Options shared by the server, edge and browser SDKs.
 *
 * **No DSN means no SDK.** Every config below calls `init` only when one is
 * set, so development, tests and anyone running this from a clone stay exactly
 * as they are — no network calls, no wrapped globals, no behaviour to reason
 * about. Monitoring that quietly changes how the app runs locally is worse than
 * none.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

/**
 * Redaction applied to every string that leaves the process.
 *
 * This is the part that needs care rather than the wiring. The paths worth
 * monitoring here are the ones that handle passenger names, contact addresses,
 * dates of birth, passport numbers and payment intents, and several of them
 * already log context into the message itself. Shipping that to a third party
 * would be a data protection problem and would contradict the privacy page.
 *
 * So the scrub runs over messages and exception values rather than relying on
 * `sendDefaultPii: false`, which only governs what the SDK adds — not what our
 * own log lines already contain.
 *
 * Patterns are deliberately broad. A redacted booking reference costs a minute
 * of cross-referencing in the admin queue; a leaked passport number cannot be
 * taken back.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  // Email addresses.
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  // Card-like runs of 13-19 digits, with or without separators.
  [/\b(?:\d[ -]?){13,19}\b/g, '[card]'],
  // Passport and document numbers: 6-9 alphanumerics with at least one digit,
  // as a standalone token. Catches more than documents, which is the intent.
  [/\b(?=[A-Z0-9]{6,9}\b)(?=[^\s]*\d)[A-Z0-9]{6,9}\b/g, '[doc]'],
  // Stripe payment intents and secrets.
  [/\b(pi|seti|cs)_[A-Za-z0-9_]+/g, '[stripe]'],
  // ISO dates, which in this codebase are as likely to be a date of birth as a
  // departure. Losing departure dates from breadcrumbs is an acceptable price.
  [/\b\d{4}-\d{2}-\d{2}\b/g, '[date]'],
];

export function scrub(input: string): string {
  return REDACTIONS.reduce((text, [pattern, replacement]) => {
    /* Fresh lastIndex each pass: these are global regexes and a shared one
       would skip matches on alternate calls. */
    pattern.lastIndex = 0;
    return text.replace(pattern, replacement);
  }, input);
}

/**
 * Applied to every event before it is sent.
 *
 * Returns the event rather than dropping it — the failure is still worth
 * knowing about, just not the particulars of whose booking it was.
 */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.message) event.message = scrub(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrub(exception.value);
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = scrub(breadcrumb.message);
  }

  /* Query strings on this product carry origin, destination, dates and
     traveller counts. Individually dull, together a travel history. The path
     is enough to locate a fault. */
  if (event.request?.query_string) delete event.request.query_string;
  if (event.request?.url) event.request.url = event.request.url.split('?')[0];
  if (event.request?.cookies) delete event.request.cookies;
  if (event.request?.headers) delete event.request.headers;

  return event;
}

export const sharedOptions = {
  dsn: SENTRY_DSN,
  /* Never send addresses, cookies or headers automatically. Our own scrub
     handles what our log lines contain; this handles what the SDK would add. */
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  /* Traces are for latency work, which is not why this is here. Off, because a
     sampled trace carries URLs and spans we would then have to scrub too. */
  tracesSampleRate: 0,
  beforeSend,
};
