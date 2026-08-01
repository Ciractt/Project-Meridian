import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sharedOptions } from '@/lib/sentry-options';

/* Middleware runs on the edge runtime and gets its own SDK instance. It only
 * refreshes the Supabase session, so there is little to catch here — but a
 * failure in it logs everyone out, which is worth knowing about. */
if (SENTRY_DSN) {
  Sentry.init({
    ...sharedOptions,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  });
}
