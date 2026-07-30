import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Editable site copy, with typed shapes and defaults.
 *
 * Every key has a default here, so the site renders correctly against an empty
 * table and a failed fetch degrades to the shipped copy rather than a blank
 * page. Editing is a convenience, not a dependency.
 *
 * Note what is deliberately NOT editable: the claims strip under the search bar.
 * Each of those lines is a promise the code actually keeps — whole price
 * itemised, ticketed immediately, no account required — and making them free text
 * would let someone write a claim the system doesn't honour. A trust claim you
 * can edit without changing the behaviour behind it is exactly the kind of thing
 * this product exists not to do.
 */

export interface Announcement {
  /** Empty means no strip. */
  text: string;
  href: string;
  linkLabel: string;
  tone: 'info' | 'caution';
  active: boolean;
  /** ISO datetime. Empty means no end. */
  endsAt: string;
}

export interface HeroCopy {
  eyebrow: string;
  headline: string;
  subhead: string;
}

export interface SiteContent {
  announcement: Announcement;
  hero: HeroCopy;
}

export const CONTENT_DEFAULTS: SiteContent = {
  announcement: {
    text: '',
    href: '',
    linkLabel: 'Find out more',
    tone: 'info',
    active: false,
    endsAt: '',
  },
  hero: {
    eyebrow: 'Flight search',
    headline: 'The price you see is the price you pay.',
    subhead: '',
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function merge<T>(fallback: T, stored: any): T {
  if (!stored || typeof stored !== 'object') return fallback;
  return { ...fallback, ...stored };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getSiteContent(): Promise<SiteContent> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from('site_content').select('key, value');

  if (error) {
    console.error('Could not load site content:', error.message);
    return CONTENT_DEFAULTS;
  }

  const byKey = new Map((data ?? []).map((row) => [String(row.key), row.value]));

  const announcement = merge(CONTENT_DEFAULTS.announcement, byKey.get('announcement'));

  return {
    // Scheduling is applied on read rather than by a job: an announcement that
    // outlives its own event is a small lie the site tells on its own.
    announcement:
      announcement.active &&
      (!announcement.endsAt || Date.parse(announcement.endsAt) > Date.now())
        ? announcement
        : CONTENT_DEFAULTS.announcement,
    hero: merge(CONTENT_DEFAULTS.hero, byKey.get('hero')),
  };
}

/** Admin read: no scheduling filter, so an expired strip is still editable. */
export async function getRawSiteContent(): Promise<SiteContent> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return CONTENT_DEFAULTS;

  const { data } = await supabase.from('site_content').select('key, value');
  const byKey = new Map((data ?? []).map((row) => [String(row.key), row.value]));

  return {
    announcement: merge(CONTENT_DEFAULTS.announcement, byKey.get('announcement')),
    hero: merge(CONTENT_DEFAULTS.hero, byKey.get('hero')),
  };
}
