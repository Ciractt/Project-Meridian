import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Fail the production build on type errors. Non-negotiable for a codebase
  // that will carry payment and booking logic. (Lint runs separately in CI —
  // Next 16 no longer takes an `eslint` config key.)
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  images: {
    // Airline logos. Duffel serves SVGs from this host and the field may be
    // null for non-IATA carriers, so every use needs a fallback.
    remotePatterns: [{ protocol: 'https', hostname: 'assets.duffel.com' }],
  },
  reactStrictMode: true,
};

/*
 * Sentry's wrapper is applied unconditionally, and does nothing without an auth
 * token: source map upload is the only build-time behaviour it adds. Wrapping
 * conditionally would mean the production build differs in shape from the one
 * run locally, which is how a build-only failure gets found in production.
 *
 * `widenClientFileUpload` off, `disableLogger` on: the first uploads maps for
 * chunks we would not read, the second strips the SDK's own console noise from
 * the client bundle.
 */
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: false,
  // Routes Sentry's own requests through our origin so an ad blocker does not
  // silently swallow the reports we are adding this for.
  tunnelRoute: '/monitoring',
});
