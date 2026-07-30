'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  completeBagPurchase,
  getBagOptions,
  startBagPurchase,
  type BagOptionsResult,
  type CompleteBagsResult,
  type StartBagsResult,
} from './services-purchase';

const startSchema = z.object({
  orderId: z.string().uuid(),
  token: z.string().uuid(),
  email: z.string().trim().max(200).optional(),
  selections: z
    .array(z.object({ id: z.string().min(1), quantity: z.coerce.number().int().min(1).max(9) }))
    .min(1)
    .max(20),
});

export async function loadBagOptions(
  orderId: string,
  email?: string,
): Promise<BagOptionsResult> {
  return getBagOptions(orderId, email);
}

export async function beginBagPurchase(raw: unknown): Promise<StartBagsResult> {
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'unavailable', message: 'Check the bags you selected.' };
  }
  return startBagPurchase(parsed.data);
}

export async function finishBagPurchase(
  orderId: string,
  token: string,
): Promise<CompleteBagsResult> {
  const result = await completeBagPurchase(token);
  revalidatePath(`/booking/${orderId}`);
  return result;
}
