import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for reconciliation.
 *
 * This code decides, for a traveller who has paid and has no clear outcome,
 * whether a ticket exists. Get it wrong in one direction and we refund someone
 * who has a valid ticket; get it wrong in the other and we keep money for a
 * flight nobody has.
 *
 * The case worth the most attention is the third one: when the lookup itself
 * fails we must NOT conclude "no order". That is the same
 * absence-of-information-is-not-negative-information rule as the createOrder
 * timeout and the null net_amount, and it is the one that is easiest to get
 * wrong, because "the list call failed" and "the list was empty" arrive at the
 * same line of code.
 */

const h = vi.hoisted(() => ({
  clientHolder: { current: null as unknown },
  getOrder: vi.fn(),
  listRecentOrders: vi.fn(),
  getPaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => h.clientHolder.current,
}));
vi.mock('@/services/duffel/orders', () => ({
  getOrder: h.getOrder,
  listRecentOrders: h.listRecentOrders,
}));
vi.mock('@/services/duffel/payments', () => ({
  getPaymentIntent: h.getPaymentIntent,
  createRefund: h.createRefund,
}));
vi.mock('@/features/booking/email', () => ({
  sendOrderConfirmationEmail: h.sendOrderConfirmationEmail,
}));

const { runReconciliation } = await import('./reconciliation');

const OLD = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    offer_id: 'off_1',
    status: 'needs_reconciliation',
    order_id: null,
    duffel_order_id: null,
    payment_intent_id: 'pit_1',
    contact_email: 'traveller@example.com',
    charge_amount: '434.59',
    charge_currency: 'GBP',
    extras_amount: '0',
    created_at: OLD,
    ...overrides,
  };
}

function duffelOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_1',
    booking_reference: 'KRSHP6',
    total_amount: '401.89',
    total_currency: 'GBP',
    owner: { name: 'British Airways' },
    passengers: [{ id: 'pas_1' }],
    slices: [
      {
        origin: { iata_code: 'NCL' },
        destination: { iata_code: 'EWR' },
        segments: [{ departing_at: '2026-08-11T07:44:00' }],
      },
    ],
    metadata: { attempt_token: 'tok-1' },
    ...overrides,
  };
}

/** Minimal Supabase double: records updates so assertions can inspect them. */
function makeClient(attempts: unknown[]) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      in: self,
      eq: self,
      not: self,
      is: self,
      order: self,
      limit: () => ({ data: attempts, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { eq: async () => ({ data: null, error: null }) };
      },
      upsert: () => ({
        select: () => ({ maybeSingle: async () => ({ data: { id: 'row-1' }, error: null }) }),
      }),
      then: undefined,
    });
    return chain;
  };

  return { client: { from: builder }, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconciliation — deciding whether a ticket exists', () => {
  it('records the order and never refunds when one is found by stored id', async () => {
    const { client, updates } = makeClient([attempt({ duffel_order_id: 'ord_1' })]);
    h.clientHolder.current = client;
    h.getOrder.mockResolvedValue(duffelOrder());

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('ticketed');
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(h.sendOrderConfirmationEmail).toHaveBeenCalledWith('row-1');
    expect(updates.some((u) => u.values.status === 'completed')).toBe(true);
  });

  it('finds a timed-out order by the attempt_token in its metadata', async () => {
    const { client } = makeClient([attempt()]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockResolvedValue([
      duffelOrder({ id: 'ord_other', metadata: { attempt_token: 'someone-else' } }),
      duffelOrder(),
    ]);

    const [report] = await runReconciliation();

    expect(report?.outcome).toMatchObject({ status: 'ticketed', reference: 'KRSHP6' });
    expect(h.createRefund).not.toHaveBeenCalled();
  });

  it('refunds when no order exists and the payment succeeded', async () => {
    const { client } = makeClient([attempt()]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockResolvedValue([]);
    h.getPaymentIntent.mockResolvedValue({
      id: 'pit_1',
      status: 'succeeded',
      amount: '434.59',
      currency: 'GBP',
    });
    h.createRefund.mockResolvedValue({ id: 'ref_1' });

    const [report] = await runReconciliation();

    expect(report?.outcome).toMatchObject({ status: 'refunded', amount: '434.59' });
    expect(h.createRefund).toHaveBeenCalledOnce();
  });

  it('does NOT refund when the lookup itself fails — unknown is not absent', async () => {
    const { client } = makeClient([attempt()]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockRejectedValue(new Error('duffel unreachable'));

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('unresolved');
    expect(h.createRefund).not.toHaveBeenCalled();
  });

  it('keeps going after one attempt fails, rather than abandoning the batch', async () => {
    const { client } = makeClient([
      attempt({ token: 'bad' }),
      attempt({ token: 'good', duffel_order_id: 'ord_1' }),
    ]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockRejectedValue(new Error('duffel unreachable'));
    h.getOrder.mockResolvedValue(duffelOrder());

    const reports = await runReconciliation();

    expect(reports).toHaveLength(2);
    expect(reports[0]?.outcome.status).toBe('unresolved');
    expect(reports[1]?.outcome.status).toBe('ticketed');
  });

  it('never touches an attempt that already resolved to an order', async () => {
    const { client } = makeClient([attempt({ order_id: 'row-existing' })]);
    h.clientHolder.current = client;

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('already_resolved');
    expect(h.getOrder).not.toHaveBeenCalled();
    expect(h.listRecentOrders).not.toHaveBeenCalled();
  });

  it('leaves a fresh attempt alone rather than racing completeBooking', async () => {
    const { client } = makeClient([attempt({ created_at: new Date().toISOString() })]);
    h.clientHolder.current = client;

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('too_recent');
    expect(h.listRecentOrders).not.toHaveBeenCalled();
  });

  it('does not refund a payment that never succeeded', async () => {
    const { client } = makeClient([attempt()]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockResolvedValue([]);
    h.getPaymentIntent.mockResolvedValue({
      id: 'pit_1',
      status: 'requires_payment_method',
      amount: '434.59',
      currency: 'GBP',
    });

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('no_payment');
    expect(h.createRefund).not.toHaveBeenCalled();
  });

  it('flags paid_not_ticketed when the refund itself fails', async () => {
    const { client, updates } = makeClient([attempt()]);
    h.clientHolder.current = client;
    h.listRecentOrders.mockResolvedValue([]);
    h.getPaymentIntent.mockResolvedValue({
      id: 'pit_1',
      status: 'succeeded',
      amount: '434.59',
      currency: 'GBP',
    });
    h.createRefund.mockRejectedValue(new Error('refund declined'));

    const [report] = await runReconciliation();

    expect(report?.outcome.status).toBe('refund_failed');
    expect(updates.some((u) => u.values.status === 'paid_not_ticketed')).toBe(true);
  });
});
