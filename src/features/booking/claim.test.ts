import { describe, expect, it, vi, beforeEach } from 'vitest';

// `server-only` throws outside an RSC bundle, the same way actions.test.ts
// neutralises it.
vi.mock('server-only', () => ({}));

const update = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: () => update() }),
}));

const { claimOrdersForEmail } = await import('./claim');

function chain(result: { data?: unknown; error?: unknown }) {
  return {
    update: () => ({
      is: () => ({
        ilike: () => ({ select: () => Promise.resolve(result) }),
      }),
    }),
  };
}

describe('claimOrdersForEmail', () => {
  beforeEach(() => update.mockReset());

  it('does nothing without an email', async () => {
    expect(await claimOrdersForEmail('user-1', undefined)).toBe(0);
    expect(await claimOrdersForEmail('user-1', '   ')).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('reports how many bookings it attached', async () => {
    update.mockReturnValue(chain({ data: [{ id: 'a' }, { id: 'b' }] }));
    expect(await claimOrdersForEmail('user-1', 'Sam@Example.com ')).toBe(2);
  });

  it('never throws when the update fails', async () => {
    update.mockReturnValue(chain({ error: { message: 'denied' } }));
    expect(await claimOrdersForEmail('user-1', 'sam@example.com')).toBe(0);
  });

  it('never throws when the request itself fails', async () => {
    update.mockReturnValue({
      update: () => ({
        is: () => ({
          ilike: () => ({ select: () => Promise.reject(new Error('network')) }),
        }),
      }),
    });
    await expect(claimOrdersForEmail('user-1', 'sam@example.com')).resolves.toBe(0);
  });
});
