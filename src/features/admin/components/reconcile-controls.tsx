'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { reconcileAttempt, reconcileNow, refundChange } from '../actions';

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


/**
 * Refund a stuck change.
 *
 * Two-step on purpose. Every other button on this page is recoverable or
 * repeatable; this one moves money and is the end of a conversation someone
 * should already have had with the traveller (ADR-045). A single click next to
 * a list of tokens is too easy to press on the wrong row.
 */
export function RefundChangeButton({ token }: { token: string }) {
  const [message, action, pending] = useActionState<string | null, FormData>(
    refundChange,
    null,
  );
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs text-link underline underline-offset-2 hover:no-underline"
      >
        Refund…
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="token" value={token} />
      <span className="text-xs text-ink-muted">Told the traveller?</span>
      <Button type="submit" variant="secondary" loading={pending}>
        Yes, refund
      </Button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-ink-faint underline underline-offset-2"
      >
        Cancel
      </button>
      {message ? (
        <span role="status" className="text-xs text-ink-muted">
          {message}
        </span>
      ) : null}
    </form>
  );
}
