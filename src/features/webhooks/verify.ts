import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a Duffel webhook signature.
 *
 * Header format:
 *   X-Duffel-Signature: t=1616202842,v1=<hex hmac>
 *
 * The signed payload is `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook
 * secret from the Duffel dashboard.
 *
 * Three details that are easy to get wrong and each defeat the whole exercise:
 *
 *  - **Use the raw body.** Parsing JSON and re-serialising changes whitespace and
 *    key order, so the hash won't match. The caller must pass `await
 *    request.text()` and only parse after verification passes.
 *  - **Compare in constant time.** A `===` on hex digests leaks information about
 *    how much of the signature was correct, one byte at a time.
 *  - **Check the timestamp.** Without a tolerance window, a captured request can
 *    be replayed indefinitely.
 *
 * A webhook endpoint without verification is worse than no endpoint: it lets
 * anyone mark orders as confirmed.
 */

/** How old a signature may be. Duffel retries for 72 hours, but a retry is
 *  re-signed, so a wide window buys nothing and costs replay protection. */
const TOLERANCE_SECONDS = 300;

export type VerificationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function verifyDuffelSignature({
  header,
  rawBody,
  secret,
}: {
  header: string | null;
  rawBody: string;
  secret: string;
}): VerificationResult {
  if (!header) return { valid: false, reason: 'missing signature header' };

  const parts = new Map(
    header.split(',').map((pair) => {
      const [key, ...rest] = pair.trim().split('=');
      return [key ?? '', rest.join('=')] as const;
    }),
  );

  const timestamp = parts.get('t');
  const provided = parts.get('v1');
  if (!timestamp || !provided) return { valid: false, reason: 'malformed signature' };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'signature timestamp outside tolerance' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  // timingSafeEqual throws on length mismatch, which is itself a signal, so the
  // length is checked first and both branches return the same generic reason.
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: 'signature mismatch' };
  }

  return { valid: true };
}
