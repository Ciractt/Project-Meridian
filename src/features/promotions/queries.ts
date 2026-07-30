import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export interface Promotion {
  id: string;
  headline: string;
  subhead: string | null;
  imageUrl: string | null;
  backgroundClass: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  partnerName: string | null;
  isPaidPlacement: boolean;
  termsHref: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
}

const COLUMNS =
  'id, headline, subhead, image_url, background_class, cta_label, cta_href, partner_name, is_paid_placement, terms_href, active, starts_at, ends_at, priority';

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPromotion(row: any): Promotion {
  return {
    id: String(row.id),
    headline: String(row.headline),
    subhead: row.subhead ?? null,
    imageUrl: row.image_url ?? null,
    backgroundClass: row.background_class ?? 'bg-night',
    ctaLabel: row.cta_label ?? null,
    ctaHref: row.cta_href ?? null,
    partnerName: row.partner_name ?? null,
    isPaidPlacement: Boolean(row.is_paid_placement),
    termsHref: row.terms_href ?? null,
    active: Boolean(row.active),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    priority: Number(row.priority ?? 0),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The promotion to show on the home page, if any.
 *
 * Uses the ordinary user-session client, not the service role: the RLS policy
 * already restricts this to promotions that are active and within their date
 * window, so the database decides what is live rather than a WHERE clause we
 * might forget to write. It also means the home page needs no secret key.
 */
export async function getLivePromotion(): Promise<Promotion | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('promotions')
    .select(COLUMNS)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    // A missing banner must never break the home page.
    console.error('Could not load promotion:', error.message);
    return null;
  }
  const row = data?.[0];
  return row ? toPromotion(row) : null;
}

/** All promotions, live or not. Admin only — hence the service client. */
export async function listPromotions(): Promise<Promotion[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('promotions')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Could not list promotions:', error.message);
    return [];
  }
  return (data ?? []).map(toPromotion);
}
