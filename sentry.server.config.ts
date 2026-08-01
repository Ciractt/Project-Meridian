import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sharedOptions } from '@/lib/sentry-options';

/*
 * Server runtime.
 *
 * captureConsoleIntegration is the whole reason this lands as a small patch
 * rather than a sixty-file rewrite. Every `console.error` in the codebase is
 * already at the point where something went wrong and already carries the
 * context that matters — the reconciliation mismatch, the refund that failed,
 * the confirmation that did not send. Rewriting them all into explicit
 * captureException calls would be a large diff whose only effect is to move
 * the same strings through a different function.
 *
 * `error` only. `warn` in this codebase means "handled, carry on".
 */
if (SENTRY_DSN) {
  Sentry.init({
    ...sharedOptions,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  });
}
