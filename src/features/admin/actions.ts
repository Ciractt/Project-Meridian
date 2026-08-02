'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/features/auth/queries';
import { resendOrderConfirmationEmail } from '@/features/booking/email';
import {
  resolveAttemptByToken,
  runReconciliation,
} from '@/features/booking/reconciliation';
import { refundStuckChange } from '@/features/booking/change-reconciliation';
import { markAssistanceForwarded } from '@/features/booking/assistance';

/**
 * Resend a confirmation that failed.
 *
 * Support-level privilege rather than admin: this is exactly the kind of thing a
 * support person should be able to do without escalating, and the blast radius is
 * one email to an address already on the order.
 */
export async function resendConfirmation(orderId: string): Promise<void> {
  await requireRole('support', '/admin');
  await resendOrderConfirmationEmail(orderId);
  revalidatePath('/admin');
}


/**
 * Run reconciliation by hand.
 *
 * Admin-level rather than support: it can issue refunds. The scheduled job does
 * the same work, so this is for when someone is waiting rather than a routine
 * action.
 */
export async function reconcileNow(
  _previous: string | null,
): Promise<string> {
  await requireRole('admin', '/admin');
  const reports = await runReconciliation();

  if (reports.length === 0) return 'Nothing needed reconciling.';

  const counts = reports.reduce<Record<string, number>>((acc, report) => {
    acc[report.outcome.status] = (acc[report.outcome.status] ?? 0) + 1;
    return acc;
  }, {});

  revalidatePath('/admin');
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${status.replace(/_/g, ' ')}`)
    .join(', ');
}

/**
 * Resolve one stuck attempt now, skipping the settle delay.
 *
 * Returns a sentence rather than void. These buttons previously reported nothing,
 * which made a working action indistinguishable from a broken one — most of the
 * time the job runs, finds the refund still failing, and correctly leaves the row
 * exactly where it was.
 */
export async function reconcileAttempt(
  _previous: string | null,
  formData: FormData,
): Promise<string> {
  await requireRole('admin', '/admin');

  const token = String(formData.get('token') ?? '');
  if (!token) return 'No attempt selected.';

  const outcome = await resolveAttemptByToken(token);
  revalidatePath('/admin');

  switch (outcome.status) {
    case 'ticketed':
      return `Found a ticket — recorded as ${outcome.reference ?? 'booked'} and the confirmation has been sent.`;
    case 'refunded':
      return `No ticket exists. Refunded ${outcome.amount} ${outcome.currency}.`;
    case 'refund_failed':
      return `No ticket exists and the refund failed again: ${outcome.message}. Refund by hand in the Duffel dashboard.`;
    case 'no_payment':
      return 'No ticket and no payment was taken. Closed.';
    case 'already_resolved':
      return 'Already resolved.';
    case 'too_recent':
      return 'Too recent to touch safely.';
    default:
      return `Couldn’t resolve it: ${outcome.message}`;
  }
}


/**
 * Refund a change that took payment and never applied.
 *
 * Admin rather than support, and deliberately manual. The reconciliation pass
 * will not do this on its own (ADR-045): the traveller's original booking is
 * still live, so a refund arriving unannounced reads as "your change went
 * through" to someone who then does not turn up for the flight they still hold.
 *
 * The precondition is a conversation, not a status. Whoever presses this should
 * already have told the person their change did not happen and that their
 * original flight stands. There is no way to enforce that in code, which is
 * exactly why it is a button a human presses rather than a rule a job applies.
 */
export async function refundChange(
  _previous: string | null,
  formData: FormData,
): Promise<string> {
  await requireRole('admin', '/admin');

  const token = String(formData.get('token') ?? '');
  if (!token) return 'No change token supplied.';

  const result = await refundStuckChange(token);
  revalidatePath('/admin');

  switch (result.status) {
    case 'refunded':
      return `Refunded ${result.amount} ${result.currency}.`;
    case 'not_found':
      return 'No charged payment found for that change.';
    default:
      return `Refund failed: ${result.message}`;
  }
}


/**
 * Record that an assistance request reached the airline.
 *
 * There is no API call to observe — Duffel cannot carry these, so somebody
 * emailed support or rang the airline. The only honest source is the person who
 * did it saying so, and `via` records how, so the trail survives them leaving.
 */
export async function forwardAssistance(
  _previous: string | null,
  formData: FormData,
): Promise<string> {
  await requireRole('support', '/admin');

  const id = String(formData.get('id') ?? '');
  const via = String(formData.get('via') ?? '').trim();
  if (!id) return 'No request selected.';
  if (!via) return 'Say how you passed it on.';

  const result = await markAssistanceForwarded(id, via);
  revalidatePath('/admin');
  return result.ok ? 'Marked as sent.' : 'Could not update that.';
}
