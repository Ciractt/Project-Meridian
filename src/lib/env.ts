import { z } from 'zod';

/**
 * Server-side environment contract.
 *
 * Parsed once at module load so a missing or malformed variable fails fast at
 * boot rather than at 2am inside a booking request. Importing this file from a
 * Client Component is a build error, which is the point: secrets cannot leak
 * into the browser bundle by accident.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Required from Phase 2 onward. Optional now so the Phase 1 app runs with no
  // credentials at all.
  DUFFEL_API_TOKEN: z.string().min(1).optional(),
  // Confirmation email. All optional so the app runs without them — when any is
  // missing the send is skipped (logged, never fatal) rather than crashing a
  // booking. `EMAIL_FROM` must be an address on a domain verified with Resend.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  // Canonical origin for building the absolute /booking/[orderId] link in the
  // email. On Vercel we fall back to VERCEL_URL; see lib/url.ts.
  SITE_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment variables. See .env.example.');
}

export const env = parsed.data;
