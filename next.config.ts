import type { NextConfig } from 'next';

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

export default nextConfig;
