import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const state = {
  rows: [] as Record<string, unknown>[],
  intentStatus: 'succeeded' as string,
  intentThrows: false,
  confirmThrows: false,
};
const updates: Record<string, unknown>[] = [];

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          order: () => ({ limit: async () => ({ data: state.rows, error: null }) }),
        }),
        eq: () => ({ maybeSingle: async () => ({ data: state.rows[0] ?? null }) }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
vi.mock('@/services/duffel/payments', () => ({
  getPaymentIntent: async () => {
    if (state.intentThrows) throw new Error('unreachable');
    return { status: state.intentStatus };
  },
  createRefund: async () => ({ id: 'ref_1' }),
}));
vi.mock('@/services/duffel/order-changes', () => ({
  confirmOrderChange: async () => {
    if (state.confirmThrows) throw new Error('airline rejected');
    return {};
  },
}));
vi.mock('@/services/duffel/orders', () => ({ getOrder: async () => ({}) }));

const { runChangeReconciliation } = await import('./change-reconciliation');

const OLD = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function row(extra: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    order_id: 'ord-1',
    status: 'awaiting_payment',
    duffel_order_change_id: 'och_1',
    payment_intent_id: 'pit_1',
    airline_amount: '80.00',
    charge_amount: '97.84',
    currency: 'GBP',
    created_at: OLD,
    ...extra,
  };
}

describe('runChangeReconciliation', () => {
  beforeEach(() => {
    updates.length = 0;
    state.intentStatus = 'succeeded';
    state.intentThrows = false;
    state.confirmThrows = false;
    state.rows = [row()];
  });

  it('leaves a change alone until it has had time to finish on its own', async () => {
    state.rows = [row({ created_at: new Date().toISOString() })];
    const [report] = await runChangeReconciliation();
    expect(report!.outcome.status).toBe('too_recent');
    expect(updates).toHaveLength(0);
  });

  it('confirms a paid change that never got confirmed', async () => {
    const [report] = await runChangeReconciliation();
    expect(report!.outcome.status).toBe('confirmed');
    expect(updates.at(-1)).toMatchObject({ status: 'completed' });
  });

  it('does not confirm a change nobody paid for', async () => {
    state.intentStatus = 'requires_payment_method';
    const [report] = await runChangeReconciliation();
    expect(report!.outcome.status).toBe('not_paid');
    expect(updates.at(-1)).toMatchObject({ failure_reason: 'abandoned_after_quote' });
  });

  it('treats an unreadable payment as unknown, not as unpaid', async () => {
    state.intentThrows = true;
    const [report] = await runChangeReconciliation();
    // Crucially not 'not_paid': that would abandon a change someone paid for.
    expect(report!.outcome.status).toBe('unresolved');
  });

  it('never refunds a change it could not apply', async () => {
    state.confirmThrows = true;
    const [report] = await runChangeReconciliation();
    expect(report!.outcome.status).toBe('needs_human');
    expect(updates.at(-1)).toMatchObject({ status: 'paid_not_changed' });
    // The original booking is still live; a silent refund would read as
    // "handled" to someone who then doesn't turn up.
    expect(updates.some((u) => 'refund_id' in u)).toBe(false);
  });

  it('closes an abandonment that never reached a quote', async () => {
    state.rows = [row({ duffel_order_change_id: null })];
    const [report] = await runChangeReconciliation();
    expect(report!.outcome.status).toBe('not_paid');
    expect(updates.at(-1)).toMatchObject({ failure_reason: 'abandoned_before_quote' });
  });
});
