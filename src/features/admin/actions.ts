'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/features/auth/queries';
import { resendOrderConfirmationEmail } from '@/features/booking/email';

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
