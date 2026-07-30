import 'server-only';
import { env } from '@/lib/env';
import {
  DuffelConfigError,
  DuffelRequestError,
  DuffelUnavailableError,
  type DuffelApiError,
} from './errors';

const BASE_URL = 'https://api.duffel.com';
const API_VERSION = 'v2';

/**
 * Thin typed wrapper over Duffel's REST API.
 *
 * Why not the official @duffel/api SDK? Two reasons, both reversible:
 *   1. The SDK ships its own HTTP client, which bypasses Next.js's extended
 *      `fetch` and with it the caching, revalidation and request-deduplication
 *      we need to keep our search-to-book ratio (and therefore our excess
 *      search bill) under control.
 *   2. We only consume four endpoints. A hundred lines we own is cheaper than
 *      a dependency whose types we'd map away from anyway.
 *
 * If Phase 3 booking logic gets hairy, adopt the SDK there — order creation is
 * a place where an officially maintained client earns its keep and caching is
 * irrelevant.
 *
 * `import 'server-only'` makes it a build error to pull this into a Client
 * Component, so the token cannot reach a browser bundle.
 */

interface RequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Abort after this many ms. Always higher than any supplier_timeout we set. */
  timeoutMs?: number;
}

export interface DuffelResponse<T> {
  data: T;
  /** HTTP status. Matters for order creation, where 202 means "accepted but not
   *  yet confirmed" and must not be treated as success. */
  status: number;
}

export async function duffelRequest<T>(options: RequestOptions): Promise<T> {
  return (await duffelRequestDetailed<T>(options)).data;
}

/**
 * As `duffelRequest`, but returns the status alongside the body.
 *
 * Only order creation needs this, and it needs it badly: a 202 means Duffel has
 * accepted the request but the order is not confirmed, and retrying can create a
 * duplicate booking. Collapsing every 2xx into "success" is how you sell two
 * tickets to one person.
 */
export async function duffelRequestDetailed<T>({
  method = 'GET',
  path,
  query,
  body,
  timeoutMs = 30_000,
}: RequestOptions): Promise<DuffelResponse<T>> {
  if (!env.DUFFEL_API_TOKEN) {
    throw new DuffelConfigError(
      'DUFFEL_API_TOKEN is not set. Add it to .env.local and restart the dev server.',
    );
  }

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.DUFFEL_API_TOKEN}`,
        'Duffel-Version': API_VERSION,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      // Search results must never be served from a stale cache: fares move.
      cache: 'no-store',
    });
  } catch (error) {
    throw new DuffelUnavailableError(
      controller.signal.aborted
        ? 'The airline search took too long to respond.'
        : 'Could not reach the flight search service.',
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      errors?: DuffelApiError[];
    } | null;
    const errors = payload?.errors ?? [];

    if (response.status >= 500) {
      throw new DuffelUnavailableError(
        errors[0]?.message ?? 'The flight search service is having trouble.',
      );
    }

    throw new DuffelRequestError(
      errors[0]?.message ?? `Duffel returned ${response.status}.`,
      response.status,
      errors,
    );
  }

  const payload = (await response.json()) as { data: T };
  return { data: payload.data, status: response.status };
}
