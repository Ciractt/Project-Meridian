import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sharedOptions } from '@/lib/sentry-options';

/*
 * Browser.
 *
 * No console capture here. The server's console lines are ours and carry
 * deliberate context; the browser's are a mix of our code, Duffel's ancillaries
 * component and whatever an extension injects, and none of the last two are
 * actionable. Unhandled exceptions and rejections still report, which is what
 * would have answered the iOS hydration question in one screenshot.
 *
 * No session replay. It records the checkout form.
 */
if (SENTRY_DSN) {
  Sentry.init(sharedOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
