import { describe, expect, it } from 'vitest';
import { beforeSend, scrub } from './sentry-options';
import type { ErrorEvent } from '@sentry/nextjs';

/**
 * The wiring is Sentry's problem. This is ours: what leaves the process.
 *
 * Every case below is drawn from a real `console.error` in this codebase, or
 * from data those paths hold when they fire.
 */
describe('scrub', () => {
  it('removes contact addresses', () => {
    expect(scrub('Could not email sam.mauricio@example.co.uk about ORD123')).not.toContain(
      'sam.mauricio@example.co.uk',
    );
    expect(scrub('to sam@example.com')).toContain('[email]');
  });

  it('removes card-length digit runs, spaced or not', () => {
    expect(scrub('4242424242424242')).toBe('[card]');
    expect(scrub('4242 4242 4242 4242')).toBe('[card]');
    expect(scrub('4242-4242-4242-4242')).toBe('[card]');
  });

  it('removes Stripe identifiers', () => {
    expect(scrub('REFUND FAILED: pi_3MtwBwLkdIwHu7ix28a3tqPa')).toContain('[stripe]');
    expect(scrub('cs_test_a1b2c3d4e5')).toContain('[stripe]');
    /* Short ids appear in fixtures and would otherwise slip through. */
    expect(scrub('REFUND FAILED: pi_1')).toContain('[stripe]');
  });

  it('removes document-shaped tokens', () => {
    expect(scrub('passport 503820394')).toContain('[doc]');
    expect(scrub('GBR12345X')).toContain('[doc]');
  });

  it('removes dates, which may be dates of birth', () => {
    expect(scrub('bornOn 1987-04-02 invalid')).toContain('[date]');
  });

  it('leaves the parts that make a report useful', () => {
    const message = scrub('Reconciliation: order ORD-8812 mismatch on NCL-FAO');
    expect(message).toContain('Reconciliation');
    expect(message).toContain('mismatch');
    expect(message).toContain('NCL-FAO');
  });

  it('is repeatable — global regexes must not carry lastIndex between calls', () => {
    const input = 'a@b.com and c@d.com';
    expect(scrub(input)).toBe(scrub(input));
    expect(scrub(input)).not.toContain('@b.com');
  });
});

describe('beforeSend', () => {
  function event(partial: Partial<ErrorEvent>): ErrorEvent {
    return partial as ErrorEvent;
  }

  it('scrubs the message, the exception value and the breadcrumbs', () => {
    const result = beforeSend(
      event({
        message: 'failed for sam@example.com',
        exception: { values: [{ value: 'card 4242424242424242 declined' }] },
        breadcrumbs: [{ message: 'lookup sam@example.com' }],
      }),
      {},
    );
    expect(result.message).toContain('[email]');
    expect(result.exception?.values?.[0]?.value).toContain('[card]');
    expect(result.breadcrumbs?.[0]?.message).toContain('[email]');
  });

  it('drops the query string, which is an itinerary', () => {
    const result = beforeSend(
      event({
        request: {
          url: 'https://example.com/search?origin=NCL&destination=FAO',
          query_string: 'origin=NCL&destination=FAO',
          cookies: { session: 'abc' },
          headers: { authorization: 'Bearer x' },
        },
      }),
      {},
    );
    expect(result.request?.url).toBe('https://example.com/search');
    expect(result.request?.query_string).toBeUndefined();
    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.headers).toBeUndefined();
  });

  it('keeps the event rather than dropping it', () => {
    expect(beforeSend(event({ message: 'plain failure' }), {})).not.toBeNull();
  });
});
