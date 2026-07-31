import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/url';

/**
 * Keeps crawlers out of everything private or per-person.
 *
 * `/booking/` matters most: those are capability URLs containing someone's
 * itinerary and reference. They are unguessable, but an indexed one is a
 * permanent leak, and search engines do find URLs from referrers and toolbars.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/booking/', '/book/', '/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
