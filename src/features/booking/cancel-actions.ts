'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  confirmCancellation,
  quoteCancellation,
  type CancelAuth,
  type ConfirmResult,
  type QuoteResult,
} from './cancellation';

const authSchema = z.object({
  orderId: z.string().uuid(),
  /** Blank means "I'm signed in as the owner"; anything else is a guest proving
   *  they know the booking's contact address. */
  email: z.string().trim().max(200).optional(),
});

function toAuth(email?: string): CancelAuth {
  return email && email.length > 0 ? { kind: 'guest', email } : { kind: 'owner' };
}

export async function getCancellationQuote(
  _previous: QuoteResult | null,
  formData: FormData,
): Promise<QuoteResult> {
  const parsed = authSchema.safeParse({
    orderId: formData.get('orderId'),
    email: formData.get('email') ?? undefined,
  });
  if (!parsed.success) {
    return { status: 'unavailable', message: 'Something was missing from that request.' };
  }
  return quoteCancellation(parsed.data.orderId, toAuth(parsed.data.email));
}

export async function applyCancellation(
  _previous: ConfirmResult | null,
  formData: FormData,
): Promise<ConfirmResult> {
  const parsed = authSchema
    .extend({ cancellationId: z.string().min(1) })
    .safeParse({
      orderId: formData.get('orderId'),
      email: formData.get('email') ?? undefined,
      cancellationId: formData.get('cancellationId'),
    });

  if (!parsed.success) {
    return { status: 'unavailable', message: 'Something was missing from that request.' };
  }

  const result = await confirmCancellation(
    parsed.data.orderId,
    parsed.data.cancellationId,
    toAuth(parsed.data.email),
  );

  revalidatePath(`/booking/${parsed.data.orderId}`);
  revalidatePath('/account');
  return result;
}
