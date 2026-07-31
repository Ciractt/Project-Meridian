import type { MetadataRoute } from 'next';
import { getRoutesWithPages } from '@/features/routes/queries';
import { siteUrl } from '@/lib/url';

/**
 * Only pages worth crawling.
 *
 * Route pages appear once they clear the substance threshold — submitting a URL
 * that says "we don't know much about this route yet" wastes crawl budget and
 * teaches a search engine that our pages are thin. The sitemap grows as the
 * demand data does.
 *
 * Account, admin and booking pages are deliberately absent: they are private,
 * per-person, or capability URLs that should never be indexed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticPages = [
    { path: '', priority: 1 },
    { path: '/how-it-works', priority: 0.7 },
    { path: '/pricing-promise', priority: 0.8 },
    { path: '/financial-protection', priority: 0.6 },
    { path: '/passenger-rights', priority: 0.5 },
    { path: '/help', priority: 0.5 },
    { path: '/help/changes-and-refunds', priority: 0.5 },
    { path: '/about', priority: 0.4 },
    { path: '/accessibility', priority: 0.3 },
    { path: '/terms', priority: 0.3 },
    { path: '/privacy', priority: 0.3 },
    { path: '/cookies', priority: 0.2 },
  ].map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: entry.priority,
  }));

  const routes = await getRoutesWithPages();

  return [
    ...staticPages,
    ...routes.map((route) => ({
      url: `${base}/flights/${route.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ];
}
