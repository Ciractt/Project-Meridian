'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Errors do not apologise and are never vague:
 * say what happened and give exactly one way forward.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 5 replaces this with Sentry. The digest is what ties a user report
    // to a server log line.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <p className="text-sm font-medium text-accent">
        Something broke
      </p>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
        We couldn’t load this page.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        Nothing was booked and nothing was charged. Try again, and if it keeps
        happening quote reference{' '}
        <span className="tabular-nums">{error.digest ?? 'unknown'}</span>.
      </p>
      <div className="mt-8">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
