import { env } from './env';

/**
 * Absolute URL for a path within this app.
 *
 * Needed server-side to put the /booking/[orderId] capability link into a
 * confirmation email, where a relative path is useless. Prefers the explicit
 * `SITE_URL` (canonical, stable across preview and production), then Vercel's
 * per-deployment `VERCEL_URL`, then localhost for development.
 *
 * Returns null only when there is no usable origin, so callers can decide
 * whether the absence is fatal — for the email it is (skip the send) rather
 * than emitting a broken link.
 */
export function absoluteUrl(path: string): string | null {
  const origin = siteOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function siteOrigin(): string | null {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, '');
  // VERCEL_URL is the deployment host with no scheme.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  if (env.NODE_ENV === 'development') return 'http://localhost:3000';
  return null;
}


/**
 * Site origin for sitemap and robots, with no trailing slash.
 *
 * These files are generated at build time where request headers aren't
 * available, so they need the configured value rather than an inferred one — and
 * a sitemap full of localhost URLs is worse than no sitemap.
 */
export function siteUrl(): string {
  const configured =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000';

  return configured.replace(/\/+$/, '');
}
