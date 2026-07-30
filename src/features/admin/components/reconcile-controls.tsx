'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { reconcileAttempt, reconcileNow } from '../actions';

/**
 * Reconciliation buttons that say what happened.
 *
 * The previous version returned void, so a run that worked and a run that did
 * nothing looked identical — and the common case is genuinely "ran, found the
 * refund still failing, correctly left the row alone". Silence made a working
 * feature look broken.
 */
export function ReconcileAllButton() {
  const [message, action, pending] = useActionState<string | null>(reconcileNow, null);

  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-3">
      <Button type="submit" variant="secondary" loading={pending}>
        Reconcile all against Duffel
      </Button>
      {message ? (
        <span role="status" className="text-xs text-ink-muted">
          {message}
        </span>
      ) : null}
    </form>
  );
}

export function ResolveAttemptButton({ token }: { token: string }) {
  const [message, action, pending] = useActionState<string | null, FormData>(
    reconcileAttempt,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="ghost" loading={pending}>
        Resolve now
      </Button>
      {message ? (
        <span role="status" className="max-w-md text-xs text-ink-muted">
          {message}
        </span>
      ) : null}
    </form>
  );
}
