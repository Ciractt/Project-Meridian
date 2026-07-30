'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/features/auth/queries';

export interface ContentFormState {
  error?: string;
  notice?: string;
}

/** Same substantiation rule as promotions: a saving claimed needs somewhere to
 *  check what it applies to. */
const SAVINGS_CLAIM = /(\d+\s*%)|\bsave\b|\boff\b|\bdiscount\b|\bhalf price\b/i;

const announcementSchema = z.object({
  text: z.string().trim().max(160),
  href: z.string().trim().max(300),
  linkLabel: z.string().trim().max(40),
  tone: z.enum(['info', 'caution']),
  active: z.boolean(),
  endsAt: z.string().trim().max(40),
});

const heroSchema = z.object({
  eyebrow: z.string().trim().max(40),
  headline: z.string().trim().min(3, 'The headline can’t be empty.').max(90),
  subhead: z.string().trim().max(200),
});

async function save(key: string, value: unknown, userId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('site_content')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: 'key' },
    );

  if (error) console.error('Could not save content %s:', key, error.message);
  return !error;
}

export async function saveAnnouncement(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole('admin', '/admin/content');

  const parsed = announcementSchema.safeParse({
    text: formData.get('text') ?? '',
    href: formData.get('href') ?? '',
    linkLabel: formData.get('linkLabel') ?? 'Find out more',
    tone: formData.get('tone') ?? 'info',
    active: formData.get('active') === 'on',
    endsAt: formData.get('endsAt') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  }

  if (parsed.data.active && parsed.data.text.length === 0) {
    return { error: 'An active strip needs something to say.' };
  }

  if (SAVINGS_CLAIM.test(parsed.data.text) && !parsed.data.href) {
    return {
      error:
        'That mentions a saving, so it needs a link where readers can check what it applies to.',
    };
  }

  /* An announcement with no end date outlives whatever it announced. Not fatal —
     some are open-ended — but worth saying out loud, because "Summer sale" still
     sitting there in November is the site misleading people by neglect. */
  const notice =
    parsed.data.active && !parsed.data.endsAt
      ? 'Saved. No end date set — remember to take it down.'
      : 'Saved.';

  const ok = await save('announcement', parsed.data, admin.id);
  if (!ok) return { error: 'Could not save.' };

  revalidatePath('/', 'layout');
  return { notice };
}

export async function saveHero(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole('admin', '/admin/content');

  const parsed = heroSchema.safeParse({
    eyebrow: formData.get('eyebrow') ?? '',
    headline: formData.get('headline') ?? '',
    subhead: formData.get('subhead') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  }

  const ok = await save('hero', parsed.data, admin.id);
  if (!ok) return { error: 'Could not save.' };

  revalidatePath('/');
  return { notice: 'Saved.' };
}
