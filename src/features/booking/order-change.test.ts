import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const state: {
  order: Record<string, unknown> | null;
  duffelOrder: { available_actions?: string[] };
  offers: unknown[];
} = {
  order: null,
  duffelOrder: { available_actions: ['change', 'cancel'] },
  offers: [],
};

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.order }) }),
      }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
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
  confirmOrderChange: async () => ({}),
}));
vi.mock('@/services/duffel/payments', () => ({ createPaymentIntent: async () => ({}) }));

const { quoteOrderChange } = await import('./order-change');

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
