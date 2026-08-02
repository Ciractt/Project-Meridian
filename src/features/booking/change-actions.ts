'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  beginOrderChange,
  completeOrderChange,
  quoteOrderChange,
  type ChangeAuth,
  type ChangeConfirmResult,
  type ChangeQuoteResult,
  type ChangeCompletionResult,
} from './order-change';

const baseSchema = z.object({
  orderId: z.string().uuid(),
  /** Blank means "I'm signed in as the owner"; anything else is a guest proving
   *  they know the booking's contact address. */
  email: z.string().trim().max(200).optional(),
});

function toAuth(email?: string): ChangeAuth {
  return email && email.length > 0 ? { kind: 'guest', email } : { kind: 'owner' };
}

export async function getChangeOptions(
  _previous: ChangeQuoteResult | null,
  formData: FormData,
): Promise<ChangeQuoteResult> {
  const parsed = baseSchema
    .extend({
      sliceId: z.string().min(1),
      origin: z.string().length(3),
      destination: z.string().length(3),
      /* Airport-local calendar date. Parsed as a string, never as a Date — a
         Date here is how a departure ends up a day out west of Greenwich. */
      departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({
      orderId: formData.get('orderId'),
      email: formData.get('email') ?? undefined,
      sliceId: formData.get('sliceId'),
      origin: formData.get('origin'),
      destination: formData.get('destination'),
      departureDate: formData.get('departureDate'),
    });

  if (!parsed.success) {
    return { status: 'unavailable', message: 'Something was missing from that request.' };
  }

  const { orderId, email, ...rest } = parsed.data;
  return quoteOrderChange({ orderId, auth: toAuth(email), ...rest });
}

export async function startChange(
  _previous: ChangeConfirmResult | null,
  formData: FormData,
): Promise<ChangeConfirmResult> {
  const parsed = baseSchema
    .extend({
      offerId: z.string().min(1),
      token: z.string().uuid(),
      sliceId: z.string().min(1),
      origin: z.string().length(3),
      destination: z.string().length(3),
      departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({
      orderId: formData.get('orderId'),
      email: formData.get('email') ?? undefined,
      offerId: formData.get('offerId'),
      token: formData.get('token'),
      sliceId: formData.get('sliceId'),
      origin: formData.get('origin'),
      destination: formData.get('destination'),
      departureDate: formData.get('departureDate'),
    });

  if (!parsed.success) {
    return { status: 'unavailable', message: 'Something was missing from that request.' };
  }

  const { orderId, email, ...rest } = parsed.data;
  const result = await beginOrderChange({ orderId, auth: toAuth(email), ...rest });

  /* A free change completes inside beginOrderChange, so the page has to catch
     up. A paid one has a card step still to come and nothing has moved yet. */
  if (result.status === 'changed' || result.status === 'refund_due') {
    revalidatePath(`/booking/${orderId}`);
    revalidatePath('/account');
  }
  return result;
}

export async function finishChange(
  _previous: ChangeCompletionResult | null,
  formData: FormData,
): Promise<ChangeCompletionResult> {
  const parsed = z
    .object({ orderId: z.string().uuid(), token: z.string().uuid() })
    .safeParse({ orderId: formData.get('orderId'), token: formData.get('token') });

  if (!parsed.success) {
    return { status: 'unavailable', message: 'Something was missing from that request.' };
  }

  const result = await completeOrderChange(parsed.data.token);
  revalidatePath(`/booking/${parsed.data.orderId}`);
  revalidatePath('/account');
  return result;
}
