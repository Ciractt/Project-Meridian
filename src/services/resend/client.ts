import 'server-only';
import { env } from '@/lib/env';

/**
 * Thin client over Resend's REST API.
 *
 * Same reasoning as the Duffel client (ADR-008): we send one shape of email
 * from one place, so a ~40-line typed wrapper over the one endpoint we use is
 * cheaper than a dependency. `import 'server-only'` keeps the API key out of any
 * browser bundle by construction.
 *
 * This layer only talks to Resend. Whether an email is worth sending, and what
 * happens when it can't be, is the caller's decision — send() throws on failure
 * and the caller (features/booking/email.ts) swallows it, because an email
 * problem must never fail a ticketed booking.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

/** True only when both the key and a from-address are configured. */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    // Transactional email is not on the booking's critical path — the ticket is
    // already issued — so a hung request should give up rather than hold the
    // response open.
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`);
  }
}
