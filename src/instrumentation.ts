import * as Sentry from '@sentry/nextjs';

/**
 * Next's server startup hook.
 *
 * The imports are dynamic and runtime-gated because the two SDKs are not
 * interchangeable — loading the Node build into the edge runtime fails at
 * import time, before anything has a chance to handle it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Errors thrown inside a Server Component render.
 *
 * Worth wiring explicitly: these are exactly the ones React swallows into
 * DYNAMIC_SERVER_USAGE-style digests with the message stripped in production,
 * which cost a day of guessing on the mobile bug. With this, the digest in the
 * console has something to be looked up against.
 */
export const onRequestError = Sentry.captureRequestError;
