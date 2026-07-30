import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DuffelUnavailableError } from '@/services/duffel/errors';
import type { Offer } from '@/features/flight-search/types';

/**
 * Tests for the compensation paths in completeBooking.
 *
 * This is the code ADR-023 is about: once the payment intent is confirmed the
 * money is ours, and every failure from that point has a defined response.
 * Getting one wrong is not a cosmetic bug — it refunds a ticket we paid for, or
 * sells two tickets to one person, or leaves someone paid-and-ticketless in
 * silence. None of that has a UI that would show it, which is exactly why it is
 * tested here.
 *
 * The seams are our own service wrappers (ADR-002's supplier boundary), mocked
 * so each failure can be provoked deterministically. pricing.ts, the Zod schema
 * and the error classes are left REAL: the coverage maths must be exercised for
 * real, the input must actually validate, and `instanceof DuffelUnavailableError`
 * — the timeout-vs-rejection distinction the whole table turns on — only works
 * against the real class.
 */

const h = vi.hoisted(() => ({
  clientHolder: { current: null as unknown },
  userHolder: { current: null as unknown },
  repriceOffer: vi.fn(),
  createOrder: vi.fn(),
  getPaymentIntent: vi.fn(),
  confirmPaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
}));

// server-only throws outside an RSC bundle; neutralise it so the module graph
// (services → flights → duffel client) loads under a plain node test.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => h.clientHolder.current,
}));
vi.mock('@/features/auth/queries', () => ({
  getCurrentUser: () => h.userHolder.current,
}));
vi.mock('@/features/booking/repricing', () => ({ repriceOffer: h.repriceOffer }));
vi.mock('@/services/duffel/orders', () => ({
  createOrder: h.createOrder,
  getOrder: vi.fn(),
}));
vi.mock('@/services/duffel/payments', () => ({
  getPaymentIntent: h.getPaymentIntent,
  confirmPaymentIntent: h.confirmPaymentIntent,
  createRefund: h.createRefund,
  createPaymentIntent: vi.fn(),
}));
vi.mock('@/features/booking/email', () => ({
  sendOrderConfirmationEmail: h.sendOrderConfirmationEmail,
}));

// Imported after the mocks are registered (vi.mock is hoisted above this).
import { completeBooking } from './actions';

/* ------------------------------------------------------------------ *
 * Fakes                                                               *
 * ------------------------------------------------------------------ */

interface DbState {
  attemptRow: Record<string, unknown> | null;
  attemptError: { message: string } | null;
  orderByIdRow: Record<string, unknown> | null;
  orderInsert: { data: { id: string } | null; error: { message: string } | null };
  updateError: { message: string } | null;
}

interface CapturedUpdate {
  table: string;
  patch: Record<string, unknown>;
}
interface CapturedInsert {
  table: string;
  payload: Record<string, unknown>;
}

/**
 * A minimal Supabase query-builder fake.
 *
 * completeBooking uses three shapes: `select…eq…maybeSingle`,
 * `insert…select…single`, and `update…eq` (awaited directly). The builder
 * records which of insert/update/select it became and resolves accordingly, and
 * captures every write so a test can assert the attempt's status transitions.
 */
function makeDb(state: DbState) {
  const updates: CapturedUpdate[] = [];
  const inserts: CapturedInsert[] = [];

  function from(table: string) {
    const op = { table, type: 'select' as 'select' | 'insert' | 'update', payload: null as unknown };

    function resolve(): Promise<unknown> {
      if (op.type === 'update') {
        updates.push({ table, patch: op.payload as Record<string, unknown> });
        return Promise.resolve({ data: null, error: state.updateError });
      }
      if (op.type === 'insert') {
        inserts.push({ table, payload: op.payload as Record<string, unknown> });
        return Promise.resolve(state.orderInsert);
      }
      if (table === 'booking_attempts') {
        return Promise.resolve({ data: state.attemptRow, error: state.attemptError });
      }
      if (table === 'orders') {
        return Promise.resolve({ data: state.orderByIdRow, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }

    const builder = {
      select: () => builder,
      insert: (payload: unknown) => {
        op.type = 'insert';
        op.payload = payload;
        return builder;
      },
      update: (payload: unknown) => {
        op.type = 'update';
        op.payload = payload;
        return builder;
      },
      eq: () => builder,
      is: () => builder,
      maybeSingle: () => resolve(),
      single: () => resolve(),
      // Thenable so an awaited `update…eq` (no terminal) resolves too.
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        resolve().then(onF, onR),
    };
    return builder;
  }

  return { client: { from }, updates, inserts };
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'off_1',
    supplierAmount: '100.00',
    currency: 'GBP',
    airline: 'Test Air',
    slices: [
      {
        originCode: 'LHR',
        destinationCode: 'JFK',
        segments: [{ departingAt: '2026-09-01T08:00:00' }],
      },
    ],
    ...overrides,
  } as unknown as Offer;
}

function makeIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_1',
    status: 'succeeded',
    amount: '108.14',
    currency: 'GBP',
    net_amount: '105.00',
    ...overrides,
  };
}

const HAPPY_ATTEMPT = {
  offer_id: 'off_1',
  payment_intent_id: 'pi_1',
  fare_amount: '100.00',
  extras_amount: '0.00',
  supplier_amount: '100.00',
  charge_currency: 'GBP',
  status: 'awaiting_payment',
  order_id: null,
  services: [],
};

const VALID_INPUT = {
  attemptToken: '11111111-1111-4111-8111-111111111111',
  contact: { email: 'traveller@example.com', phoneNumber: '+447700900123' },
  passengers: [
    {
      id: 'pas_1',
      type: 'adult',
      title: 'mr',
      givenName: 'Ada',
      familyName: 'Lovelace',
      bornOn: '1990-01-01',
      gender: 'f',
    },
  ],
};

let db: ReturnType<typeof makeDb>;
let state: DbState;

function lastAttemptPatch(): Record<string, unknown> | undefined {
  const attemptWrites = db.updates.filter((u) => u.table === 'booking_attempts');
  return attemptWrites.at(-1)?.patch;
}

beforeEach(() => {
  vi.clearAllMocks();

  state = {
    attemptRow: { ...HAPPY_ATTEMPT },
    attemptError: null,
    orderByIdRow: null,
    orderInsert: { data: { id: 'ord_local_1' }, error: null },
    updateError: null,
  };
  db = makeDb(state);
  h.clientHolder.current = db.client;
  h.userHolder.current = null;

  h.repriceOffer.mockResolvedValue({ status: 'ok', offer: makeOffer(), changed: false });
  h.getPaymentIntent.mockResolvedValue(makeIntent());
  h.confirmPaymentIntent.mockResolvedValue(makeIntent());
  h.createOrder.mockResolvedValue({
    status: 'confirmed',
    order: { id: 'ord_duffel_1', booking_reference: 'ABC123' },
  });
  h.createRefund.mockResolvedValue({ id: 'ref_1' });
  h.sendOrderConfirmationEmail.mockResolvedValue(undefined);
});

/* ------------------------------------------------------------------ *
 * The happy path                                                     *
 * ------------------------------------------------------------------ */

describe('completeBooking — success', () => {
  it('tickets, records the order, sends the confirmation, and never refunds', async () => {
    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({
      status: 'booked',
      orderId: 'ord_local_1',
      reference: 'ABC123',
    });
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(h.sendOrderConfirmationEmail).toHaveBeenCalledWith('ord_local_1');
    expect(lastAttemptPatch()).toMatchObject({
      status: 'completed',
      order_id: 'ord_local_1',
    });
  });

  it('records what the airline is owed and what the card was charged, kept apart', async () => {
    // The order row stores supplierAmount as total (owed to the airline) and the
    // intent amount as charged (includes our fee). Conflating them is a money bug.
    await completeBooking(VALID_INPUT);

    const orderInsert = db.inserts.find((i) => i.table === 'orders');
    expect(orderInsert?.payload).toMatchObject({
      total_amount: '100.00',
      total_currency: 'GBP',
      charged_amount: '108.14',
      charged_currency: 'GBP',
    });
  });

  it('confirms an unconfirmed intent before ticketing', async () => {
    h.getPaymentIntent.mockResolvedValue(makeIntent({ status: 'requires_confirmation' }));
    h.confirmPaymentIntent.mockResolvedValue(makeIntent({ status: 'succeeded' }));

    const result = await completeBooking(VALID_INPUT);

    expect(h.confirmPaymentIntent).toHaveBeenCalledWith('pi_1');
    expect(result.status).toBe('booked');
  });

  it('proceeds on the charge-covers-fare bound when net_amount is not yet known', async () => {
    // net_amount lags `succeeded` by moments. Absence of a net figure is not a
    // shortfall; the charge we collected already proves coverage.
    h.getPaymentIntent.mockResolvedValue(makeIntent({ net_amount: null }));

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('booked');
    expect(h.createRefund).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * The refund paths — a ticket cannot exist, so give the money back    *
 * ------------------------------------------------------------------ */

describe('completeBooking — full refund when no ticket can exist', () => {
  it('refunds when the offer is withdrawn between payment and ticketing', async () => {
    h.repriceOffer.mockResolvedValue({ status: 'expired' });

    const result = await completeBooking(VALID_INPUT);

    expect(result).toMatchObject({ status: 'refunded', reason: 'offer_gone' });
    expect(h.createRefund).toHaveBeenCalledWith({
      paymentIntentId: 'pi_1',
      amount: '108.14',
      currency: 'GBP',
    });
    expect(h.createOrder).not.toHaveBeenCalled();
    expect(lastAttemptPatch()).toMatchObject({
      status: 'failed',
      failure_reason: 'refunded',
      refund_id: 'ref_1',
    });
  });

  it('refunds when the fare rose above the confirmed net amount', async () => {
    h.getPaymentIntent.mockResolvedValue(makeIntent({ net_amount: '90.00' }));

    const result = await completeBooking(VALID_INPUT);

    expect(result).toMatchObject({ status: 'refunded', reason: 'fare_increased' });
    expect(h.createRefund).toHaveBeenCalled();
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it('refunds on a shortfall even when net is unknown but the charge cannot cover it', async () => {
    // net_amount null AND the charge itself is too small: positive evidence of a
    // shortfall, not mere absence of information.
    h.getPaymentIntent.mockResolvedValue(
      makeIntent({ net_amount: null, amount: '80.00' }),
    );

    const result = await completeBooking(VALID_INPUT);

    expect(result).toMatchObject({ status: 'refunded', reason: 'fare_increased' });
    expect(h.createRefund).toHaveBeenCalled();
  });

  it('refunds when the airline definitively declines the order', async () => {
    h.createOrder.mockRejectedValue(new Error('airline said no'));

    const result = await completeBooking(VALID_INPUT);

    expect(result).toMatchObject({
      status: 'refunded',
      reason: 'airline_declined',
      message: 'airline said no',
    });
    expect(h.createRefund).toHaveBeenCalled();
  });

  it('leaves the attempt paid_not_ticketed for a human when the refund itself fails', async () => {
    h.repriceOffer.mockResolvedValue({ status: 'expired' });
    h.createRefund.mockRejectedValue(new Error('refund gateway down'));

    const result = await completeBooking(VALID_INPUT);

    // The caller is still told it's a refund; the failed refund surfaces to admin.
    expect(result).toMatchObject({ status: 'refunded', reason: 'offer_gone' });
    expect(lastAttemptPatch()).toMatchObject({
      status: 'paid_not_ticketed',
      failure_reason: 'refund_failed',
    });
  });
});

/* ------------------------------------------------------------------ *
 * The reconciliation paths — a ticket MIGHT exist. Never refund.      *
 * ------------------------------------------------------------------ */

describe('completeBooking — reconciliation, never a refund or a retry', () => {
  it('flags a createOrder timeout for reconciliation and does NOT refund', async () => {
    // The single most important row in ADR-023: a timeout is absence of
    // information, not a failed booking. Refunding gives away a ticket we may
    // have paid for; retrying sells two.
    h.createOrder.mockRejectedValue(new DuffelUnavailableError('order create timed out'));

    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({ status: 'needs_reconciliation' });
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(lastAttemptPatch()).toMatchObject({
      status: 'needs_reconciliation',
      failure_reason: 'order_create_timeout',
    });
  });

  it('flags a 202 accepted-not-confirmed order for reconciliation without refunding or emailing', async () => {
    h.createOrder.mockResolvedValue({ status: 'pending', orderId: 'ord_duffel_202' });

    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({ status: 'needs_reconciliation' });
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(h.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(lastAttemptPatch()).toMatchObject({
      status: 'needs_reconciliation',
      failure_reason: 'order_accepted_not_confirmed',
      duffel_order_id: 'ord_duffel_202',
    });
  });

  it('reports success but flags reconciliation when the ticket issued and only our DB write failed', async () => {
    // The ticket is valid. Never refund a valid ticket over a bookkeeping error.
    state.orderInsert = { data: null, error: { message: 'orders insert failed' } };

    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({
      status: 'booked',
      orderId: 'ord_duffel_1',
      reference: 'ABC123',
    });
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(h.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(lastAttemptPatch()).toMatchObject({
      status: 'needs_reconciliation',
      failure_reason: 'order_not_recorded',
    });
  });

  it('treats a failed attempt read as reconciliation, since the traveller may already have paid', async () => {
    state.attemptRow = null;
    state.attemptError = { message: 'db read failed' };

    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({ status: 'needs_reconciliation' });
    expect(h.getPaymentIntent).not.toHaveBeenCalled();
    expect(h.createOrder).not.toHaveBeenCalled();
    expect(h.createRefund).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * Guards before any money moves                                       *
 * ------------------------------------------------------------------ */

describe('completeBooking — nothing charged, nothing to compensate', () => {
  it('returns not_paid when the payment never succeeds and cannot be confirmed', async () => {
    h.getPaymentIntent.mockResolvedValue(makeIntent({ status: 'requires_payment_method' }));
    h.confirmPaymentIntent.mockRejectedValue(new Error('card declined'));

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('not_paid');
    expect(h.createOrder).not.toHaveBeenCalled();
    expect(h.createRefund).not.toHaveBeenCalled();
  });

  it('returns not_paid when confirmation still does not reach succeeded', async () => {
    h.getPaymentIntent.mockResolvedValue(makeIntent({ status: 'requires_action' }));
    h.confirmPaymentIntent.mockResolvedValue(makeIntent({ status: 'processing' }));

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('not_paid');
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it('returns not_paid when no payment intent was ever bound to the attempt', async () => {
    state.attemptRow = { ...HAPPY_ATTEMPT, payment_intent_id: null };

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('not_paid');
    expect(h.getPaymentIntent).not.toHaveBeenCalled();
  });

  it('returns not_paid when no attempt row exists at all', async () => {
    state.attemptRow = null;

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('not_paid');
    expect(h.getPaymentIntent).not.toHaveBeenCalled();
  });

  it('is unavailable when booking storage is not configured', async () => {
    h.clientHolder.current = null;

    const result = await completeBooking(VALID_INPUT);

    expect(result.status).toBe('unavailable');
  });

  it('rejects invalid input before touching payment or the airline', async () => {
    const result = await completeBooking({ attemptToken: 'not-a-uuid' });

    expect(result.status).toBe('invalid');
    expect(h.getPaymentIntent).not.toHaveBeenCalled();
    expect(h.createOrder).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * Idempotent replay                                                   *
 * ------------------------------------------------------------------ */

describe('completeBooking — already ticketed', () => {
  it('returns the existing booking without re-charging or re-ticketing', async () => {
    state.attemptRow = { ...HAPPY_ATTEMPT, order_id: 'ord_local_existing' };
    state.orderByIdRow = { id: 'ord_local_existing', booking_reference: 'PNR9' };

    const result = await completeBooking(VALID_INPUT);

    expect(result).toEqual({
      status: 'booked',
      orderId: 'ord_local_existing',
      reference: 'PNR9',
    });
    expect(h.getPaymentIntent).not.toHaveBeenCalled();
    expect(h.createOrder).not.toHaveBeenCalled();
    expect(h.createRefund).not.toHaveBeenCalled();
    expect(h.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});
