import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const state: {
  order: Record<string, unknown> | null;
  duffelOrder: { available_actions?: string[] };
  offers: unknown[];
  changeRow: Record<string, unknown> | null;
  intentStatus: string;
  confirmChangeThrows: boolean;
} = {
  order: null,
  duffelOrder: { available_actions: ['change', 'cancel'] },
  offers: [],
  changeRow: null,
  intentStatus: 'succeeded',
  confirmChangeThrows: false,
};
const updates: Record<string, unknown>[] = [];
const refundCalls: unknown[] = [];

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === 'order_changes' ? state.changeRow : state.order,
          }),
        }),
      }),
      insert: async () => ({ error: null }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
vi.mock('@/features/auth/queries', () => ({ getCurrentUser: async () => null }));
vi.mock('@/services/duffel/orders', () => ({
  getOrder: async () => state.duffelOrder,
}));
vi.mock('@/services/duffel/order-changes', () => ({
  requestOrderChange: async () => ({ order_change_offers: state.offers }),
  createOrderChange: async () => ({}),
  confirmOrderChange: async () => {
    if (state.confirmChangeThrows) throw new Error('airline rejected');
    return {};
  },
}));
vi.mock('@/services/duffel/payments', () => ({
  createPaymentIntent: async () => ({}),
  getPaymentIntent: async () => ({
    id: 'pit_1',
    status: state.intentStatus,
    amount: '97.84',
    currency: 'GBP',
  }),
  confirmPaymentIntent: async () => ({
    id: 'pit_1',
    status: state.intentStatus,
    amount: '97.84',
    currency: 'GBP',
  }),
  createRefund: async (...args: unknown[]) => {
    refundCalls.push(args);
    return { id: 'ref_1' };
  },
}));

const { completeOrderChange, quoteOrderChange } = await import('./order-change');

function offer(id: string, amount: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    change_total_amount: amount,
    change_total_currency: 'GBP',
    expires_at: null,
    slices: {
      add: [
        {
          segments: [
            { departing_at: '2026-09-01T08:00:00', arriving_at: '2026-09-01T11:00:00' },
          ],
        },
      ],
      remove: [],
    },
    ...extra,
  };
}

const auth = { kind: 'guest', email: 'sam@example.com' } as const;
const request = {
  orderId: 'ord-1',
  auth,
  sliceId: 'sli_1',
  origin: 'NCL',
  destination: 'FAO',
  departureDate: '2026-09-01',
};

describe('quoteOrderChange', () => {
  beforeEach(() => {
    state.order = {
      id: 'ord-1',
      duffel_order_id: 'ord_duffel_1',
      contact_email: 'sam@example.com',
      user_id: null,
      cancelled_at: null,
      charged_currency: 'GBP',
    };
    state.duffelOrder = { available_actions: ['change'] };
    state.offers = [];
  });

  it('refuses a stranger holding the link but not the email', async () => {
    const result = await quoteOrderChange({
      ...request,
      auth: { kind: 'guest', email: 'someone@else.com' },
    });
    expect(result.status).toBe('forbidden');
  });

  it('does not offer a change the airline will not accept', async () => {
    state.duffelOrder = { available_actions: ['cancel'] };
    const result = await quoteOrderChange(request);
    expect(result.status).toBe('not_changeable');
  });

  it('does not offer to change a cancelled booking', async () => {
    state.order = { ...state.order, cancelled_at: '2026-08-01T00:00:00Z' };
    const result = await quoteOrderChange(request);
    expect(result.status).toBe('not_changeable');
  });

  it('says so plainly when the airline has nothing', async () => {
    const result = await quoteOrderChange(request);
    expect(result.status).toBe('none');
  });

  it('prices every option and puts the cheapest first', async () => {
    state.offers = [offer('a', '120.00'), offer('b', '40.00'), offer('c', '80.00')];
    const result = await quoteOrderChange(request);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.options.map((o) => o.offerId)).toEqual(['b', 'c', 'a']);
    expect(result.options[0]!.handlingFee).toBe('15.00');
    expect(result.options[0]!.airlineAmount).toBe('40.00');
  });

  it('carries a refund and where it goes, rather than a charge', async () => {
    state.offers = [offer('r', '-30.00', { refund_to: 'airline_credits' })];
    const result = await quoteOrderChange(request);
    if (result.status !== 'ok') throw new Error('expected ok');
    const only = result.options[0]!;
    expect(only.refundAmount).toBe('30.00');
    expect(only.refundTo).toBe('airline_credits');
    expect(only.chargeAmount).toBe('0.00');
    expect(only.handlingFee).toBe('0.00');
  });

  it('charges nothing at all for a free change', async () => {
    state.offers = [offer('f', '0.00')];
    const result = await quoteOrderChange(request);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.options[0]!.chargeAmount).toBe('0.00');
    expect(result.options[0]!.handlingFee).toBe('0.00');
  });
});

describe('completeOrderChange', () => {
  beforeEach(() => {
    updates.length = 0;
    state.changeRow = {
      token: 'tok-1',
      order_id: 'ord-1',
      status: 'awaiting_payment',
      duffel_order_change_id: 'och_1',
      payment_intent_id: 'pit_1',
      airline_amount: '80.00',
      charge_amount: '97.84',
      currency: 'GBP',
    };
    state.intentStatus = 'succeeded';
    state.confirmChangeThrows = false;
  });

  it('applies the change and reports what was charged', async () => {
    const result = await completeOrderChange('tok-1');
    expect(result).toEqual({ status: 'changed', charged: '97.84', currency: 'GBP' });
    expect(updates.at(-1)).toMatchObject({ status: 'completed' });
  });

  it('marks paid before calling the airline, not after', async () => {
    await completeOrderChange('tok-1');
    // If the process dies between the two, reconciliation must find a row that
    // says the money moved.
    expect(updates[0]).toMatchObject({ status: 'paid_not_changed' });
  });

  it('does not apply a change nobody paid for', async () => {
    state.intentStatus = 'requires_payment_method';
    const result = await completeOrderChange('tok-1');
    expect(result.status).toBe('not_paid');
    expect(updates).toHaveLength(0);
  });

  it('is safe to call twice', async () => {
    state.changeRow = { ...state.changeRow, status: 'completed' };
    const result = await completeOrderChange('tok-1');
    expect(result.status).toBe('already_done');
    expect(updates).toHaveLength(0);
  });

  it('never refunds a change it could not apply', async () => {
    state.confirmChangeThrows = true;
    const result = await completeOrderChange('tok-1');
    expect(result.status).toBe('needs_attention');
    // The traveller still holds a valid ticket. A refund on its own would read
    // as "your change went through" — ADR-045.
    expect(refundCalls).toHaveLength(0);
    expect(updates.at(-1)).toMatchObject({
      failure_reason: expect.stringContaining('confirm_failed'),
    });
  });
});
