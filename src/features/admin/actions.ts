'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/features/auth/queries';
import { resendOrderConfirmationEmail } from '@/features/booking/email';
import {
  resolveAttemptByToken,
  runReconciliation,
} from '@/features/booking/reconciliation';

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
