'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { recordAssistanceRequest, type AssistanceResult } from './assistance';

const schema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().max(200).optional(),
  passengerLabel: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).optional(),
});

export async function requestAssistance(
  _previous: AssistanceResult | null,
  formData: FormData,
): Promise<AssistanceResult> {
  const parsed = schema.safeParse({
    orderId: formData.get('orderId'),
    email: formData.get('email') ?? undefined,
    passengerLabel: formData.get('passengerLabel') ?? '',
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'invalid', message: 'Say who the assistance is for.' };
  }

  const result = await recordAssistanceRequest({
    ...parsed.data,
    codes: formData.getAll('codes').map(String),
  });

  if (result.status === 'received') revalidatePath(`/booking/${parsed.data.orderId}`);
  return result;
}
