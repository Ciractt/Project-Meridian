import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const headerStore = { get: vi.fn() };

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc }),
}));
vi.mock('next/headers', () => ({
  headers: async () => headerStore,
}));

const { consumeSearchQuota, describeRetryAfter } = await import('./rate-limit');

/** The rpc chain: `.rpc(...).maybeSingle()`. */
function reply(result: { data?: unknown; error?: unknown }) {
  rpc.mockReturnValue({ maybeSingle: () => Promise.resolve(result) });
}

/** Default limit is 40 per 900s unless the env overrides it. */
const now = new Date().toISOString();

describe('consumeSearchQuota', () => {
  beforeEach(() => {
    rpc.mockReset();
    headerStore.get.mockReset();
    headerStore.get.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7, 10.0.0.1' : null,
    );
  });

  it('allows a caller inside the limit', async () => {
    reply({ data: { used: 1, window_started: now } });
    expect(await consumeSearchQuota()).toEqual({ status: 'allowed' });
  });

  it('charges the client address, not the proxy chain', async () => {
    reply({ data: { used: 1, window_started: now } });
    await consumeSearchQuota();
    expect(rpc).toHaveBeenCalledWith(
      'consume_search_quota',
      expect.objectContaining({ p_key: 'ip:203.0.113.7' }),
    );
  });

  it('allows the request that lands exactly on the limit', async () => {
    reply({ data: { used: 40, window_started: now } });
    expect(await consumeSearchQuota()).toEqual({ status: 'allowed' });
  });

  it('throttles past it, and says how long is left', async () => {
    reply({ data: { used: 41, window_started: now } });
    const outcome = await consumeSearchQuota();
    expect(outcome.status).toBe('throttled');
    if (outcome.status !== 'throttled') return;
    expect(outcome.retryAfterSeconds).toBeGreaterThan(880);
    expect(outcome.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('never reports a retry in the past', async () => {
    const stale = new Date(Date.now() - 5_000_000).toISOString();
    reply({ data: { used: 41, window_started: stale } });
    const outcome = await consumeSearchQuota();
    if (outcome.status !== 'throttled') throw new Error('expected throttled');
    expect(outcome.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('fails open when the counter errors', async () => {
    reply({ error: { message: 'relation does not exist' } });
    expect(await consumeSearchQuota()).toEqual({ status: 'unknown' });
  });

  it('fails open when the request throws', async () => {
    rpc.mockImplementation(() => {
      throw new Error('network');
    });
    await expect(consumeSearchQuota()).resolves.toEqual({ status: 'unknown' });
  });

  it('skips the limit when there is no address to charge', async () => {
    headerStore.get.mockReturnValue(null);
    reply({ data: { used: 1, window_started: now } });
    expect(await consumeSearchQuota()).toEqual({ status: 'unknown' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('describeRetryAfter', () => {
  it('reads as a human would say it', () => {
    expect(describeRetryAfter(1)).toBe('1 second');
    expect(describeRetryAfter(45)).toBe('45 seconds');
    expect(describeRetryAfter(600)).toBe('10 minutes');
    expect(describeRetryAfter(61)).toBe('61 seconds');
  });
});
