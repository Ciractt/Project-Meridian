/**
 * Supabase connection details, resolved once.
 *
 * The key name is awkward for a reason. Supabase renamed its client-side key:
 * projects created from November 2025 onward get a `sb_publishable_...` key and
 * have no `anon` key at all, while the local CLI stack still prints an
 * `anon key`. Both go in the same slot, so we accept either variable name and
 * prefer the newer one.
 *
 * Throwing here rather than using `!` means a missing variable produces a
 * sentence you can act on instead of "Cannot read properties of undefined".
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local, fill it in, and restart the dev server.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

const clientKey = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Refuse to start if a secret key has been put in a public variable.
 *
 * Anything prefixed NEXT_PUBLIC_ is inlined into the browser bundle, so a
 * secret key here is published to every visitor — and it bypasses row-level
 * security entirely. That is total database compromise from one copy-paste.
 *
 * Failing the build is the correct response. A warning would be ignored.
 */
if (clientKey.startsWith('sb_secret_')) {
  throw new Error(
    'A Supabase SECRET key is set in a NEXT_PUBLIC_ variable. That publishes ' +
      'full database access to every visitor. Move it to SUPABASE_SECRET_KEY, ' +
      'put the publishable key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and ' +
      'delete the exposed key in the Supabase dashboard — it must be treated ' +
      'as compromised.',
  );
}

export const SUPABASE_CLIENT_KEY = clientKey;
