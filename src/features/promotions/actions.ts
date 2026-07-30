'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/features/auth/queries';

export interface PromotionFormState {
  error?: string;
  notice?: string;
}

/** Words that turn a headline into a savings claim needing substantiation. */
const SAVINGS_CLAIM = /(\d+\s*%)|\bsave\b|\boff\b|\bdiscount\b|\bwas\b|\bhalf price\b/i;

const schema = z.object({
  headline: z.string().trim().min(3, 'Give the banner a headline.').max(80),
  subhead: z.string().trim().max(160).optional(),
  imageUrl: z.string().trim().url('Image must be a full https URL.').optional(),
  ctaLabel: z.string().trim().max(30).optional(),
  ctaHref: z.string().trim().max(300).optional(),
  partnerName: z.string().trim().max(60).optional(),
  isPaidPlacement: z.boolean(),
  termsHref: z.string().trim().max(300).optional(),
  endsAt: z.string().trim().optional(),
});

/**
 * Create a promotion.
 *
 * Two refusals are built in, and both exist to protect the person filling the
 * form from their own commercial pressure:
 *
 *  - A paid placement without a partner to name cannot be disclosed, so it is
 *    rejected. The database has the same constraint; this one produces a
 *    readable message.
 *  - A headline making a savings claim without a terms link is rejected. "Up to
 *    20% off" with nowhere to check what it applies to is a misleading practice
 *    under the DMCC Act, not merely sloppy copy.
 */
export async function createPromotion(
  _previous: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const admin = await requireRole('admin', '/admin');

  const parsed = schema.safeParse({
    headline: formData.get('headline'),
    subhead: str(formData.get('subhead')),
    imageUrl: str(formData.get('imageUrl')),
    ctaLabel: str(formData.get('ctaLabel')),
    ctaHref: str(formData.get('ctaHref')),
    partnerName: str(formData.get('partnerName')),
    isPaidPlacement: formData.get('isPaidPlacement') === 'on',
    termsHref: str(formData.get('termsHref')),
    endsAt: str(formData.get('endsAt')),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  }
  const input = parsed.data;

  if (input.isPaidPlacement && !input.partnerName) {
    return {
      error:
        'A paid placement needs a partner name so it can be labelled as advertising.',
    };
  }

  if (SAVINGS_CLAIM.test(input.headline) && !input.termsHref) {
    return {
      error:
        'This headline makes a savings claim, so it needs a terms link readers can check.',
    };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return { error: 'Promotions storage isn’t configured.' };

  const { error } = await supabase.from('promotions').insert({
    headline: input.headline,
    subhead: input.subhead ?? null,
    image_url: input.imageUrl ?? null,
    cta_label: input.ctaLabel ?? null,
    cta_href: input.ctaHref ?? null,
    partner_name: input.partnerName ?? null,
    is_paid_placement: input.isPaidPlacement,
    terms_href: input.termsHref ?? null,
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    active: false,
    created_by: admin.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/promotions');
  return { notice: 'Saved as inactive. Review it, then switch it on.' };
}

/** Activating one banner deactivates the rest — only one shows at a time. */
export async function setPromotionActive(id: string, active: boolean): Promise<void> {
  await requireRole('admin', '/admin');

  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  if (active) {
    await supabase.from('promotions').update({ active: false }).neq('id', id);
  }
  await supabase.from('promotions').update({ active }).eq('id', id);

  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

export async function deletePromotion(id: string): Promise<void> {
  await requireRole('admin', '/admin');
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  await supabase.from('promotions').delete().eq('id', id);
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

function str(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : undefined;
}
