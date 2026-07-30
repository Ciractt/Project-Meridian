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
export async function reconcileNow(): Promise<void> {
  await requireRole('admin', '/admin');
  await runReconciliation();
  revalidatePath('/admin');
}

/** Resolve one stuck attempt immediately, skipping the settle delay. */
export async function reconcileAttempt(token: string): Promise<void> {
  await requireRole('admin', '/admin');
  await resolveAttemptByToken(token);
  revalidatePath('/admin');
}
