/**
 * What we charge the customer, and why it isn't the fare.
 *
 * Four amounts are in play and conflating any two of them loses money:
 *
 *   fare      — what the airline charges for the flights.
 *   extras    — what the airline charges for bags and seats.
 *   charge    — what the customer's card is charged.
 *   net       — what reaches our balance: charge less Duffel's processing fee.
 *
 * The binding constraint is `net >= fare + extras`. If it isn't, we have sold
 * below cost and the order cannot be paid for. So the charge is grossed up:
 *
 *   charge = (fare + fareMargin + extras + extrasMargin) / (1 - feeRate)
 *
 * Dividing, not multiplying. Adding 2.9% to a total does not recover a 2.9% fee
 * taken *from* that total — a mistake that loses a little on every booking and
 * stays invisible until you reconcile.
 */

/** Margin on the flights. */
const FARE_MARGIN_RATE = Number(process.env.BOOKING_MARGIN_RATE ?? '0.05');

/**
 * Margin on bags and seats, which carry more headroom than fares.
 *
 * Kept as a separate dial on purpose: ancillary margin is the main lever on
 * overall take rate, and tuning it should not mean touching fare pricing.
 *
 * This rate is ALSO passed to Duffel's ancillaries component as its `markup`, so
 * the price shown next to a bag is the price it adds to the total. Applying
 * margin here as well would double-count — see `extrasMarginRate`.
 */
const EXTRAS_MARGIN_RATE = Number(process.env.BOOKING_EXTRAS_MARGIN_RATE ?? '0.15');

/**
 * Assumed Duffel Payments processing rate for the gross-up.
 *
 * The real rate depends on where the card was issued — lower for European cards,
 * higher for the rest — and we cannot know that until after the card is entered,
 * which is after the charge amount is fixed. So we gross up at the higher rate.
 * The consequence is a slightly better margin on European cards rather than a
 * loss on non-European ones, which is the right way round to be wrong.
 */
const ASSUMED_FEE_RATE = Number(process.env.BOOKING_ASSUMED_FEE_RATE ?? '0.029');

/**
 * What we add for handling a change. A flat amount, not a rate.
 *
 * Deliberately unlike every other price in this file. A percentage of a change
 * cost scales with the airline's penalty, which means the worse the fare rules
 * treat someone, the more we take — and the traveller changing a £400 flight
 * pays us eight times the one changing a £50 flight for the same work, which is
 * the same work. Taking a cut of somebody's bad day is exactly the sort of
 * thing ADR-038's itemisation would make visible, and it should not survive
 * being visible.
 *
 * Zero is a supported setting and a defensible one.
 */
const CHANGE_FEE = Number(process.env.BOOKING_CHANGE_FEE ?? '15.00');

/** Exposed so the ancillaries component marks bags up by the same rate. */
export function extrasMarginRate(): number {
  return EXTRAS_MARGIN_RATE;
}

export interface ChargeBreakdown {
  /** Owed to the airline for flights. */
  fareAmount: string;
  /** Owed to the airline for bags and seats. */
  extrasAmount: string;
  /** Owed to the airline in total — what `net` has to cover. */
  supplierAmount: string;
  /** What the card is charged. */
  chargeAmount: string;
  /** Our margin before Duffel's fee. Informational. */
  marginAmount: string;
  currency: string;
}

/** Rounds up to the minor unit, so rounding never eats into margin. */
function toMinorUnitCeil(value: number): string {
  return (Math.ceil(value * 100) / 100).toFixed(2);
}

export function calculateCharge(
  fareAmount: string,
  currency: string,
  extrasAmount = '0.00',
): ChargeBreakdown {
  const fare = Number(fareAmount);
  const extras = Number(extrasAmount);

  if (!Number.isFinite(fare) || fare <= 0) {
    throw new Error(`Cannot price a booking from fare "${fareAmount}".`);
  }
  if (!Number.isFinite(extras) || extras < 0) {
    throw new Error(`Cannot price extras of "${extrasAmount}".`);
  }

  const margin = fare * FARE_MARGIN_RATE + extras * EXTRAS_MARGIN_RATE;
  const supplier = fare + extras;
  const charge = (supplier + margin) / (1 - ASSUMED_FEE_RATE);

  return {
    fareAmount: fare.toFixed(2),
    extrasAmount: extras.toFixed(2),
    supplierAmount: supplier.toFixed(2),
    chargeAmount: toMinorUnitCeil(charge),
    marginAmount: margin.toFixed(2),
    currency,
  };
}

/**
 * Charge for extras bought on their own, after a booking exists.
 *
 * No fare involved, so only the ancillary margin applies — charging the fare
 * margin again on a post-booking bag would be taking a second cut for a sale
 * already made.
 */
export function calculateExtrasCharge(
  extrasAmount: string,
  currency: string,
): ChargeBreakdown {
  const extras = Number(extrasAmount);
  if (!Number.isFinite(extras) || extras <= 0) {
    throw new Error(`Cannot price extras of "${extrasAmount}".`);
  }

  const margin = extras * EXTRAS_MARGIN_RATE;
  const charge = (extras + margin) / (1 - ASSUMED_FEE_RATE);

  return {
    fareAmount: '0.00',
    extrasAmount: extras.toFixed(2),
    supplierAmount: extras.toFixed(2),
    chargeAmount: toMinorUnitCeil(charge),
    marginAmount: margin.toFixed(2),
    currency,
  };
}

export interface ChangeBreakdown {
  /** Owed to the airline. Signed: negative means they owe us. */
  airlineAmount: string;
  /** Our flat handling fee. Not charged when the airline owes money. */
  handlingFee: string;
  /**
   * What the card is charged. Never negative — a change that comes back cheaper
   * is a refund, not a negative charge, and the two are settled differently.
   */
  chargeAmount: string;
  /** Present only when the change is in the traveller's favour. */
  refundAmount: string | null;
  currency: string;
}

/**
 * Price a change.
 *
 * Three cases, and they are genuinely different rather than one formula with
 * signs:
 *
 * - **Costs money.** Pass the airline's figure through at cost, add the flat
 *   fee, gross up for card processing. No margin on the fare difference: the
 *   sale was already made and marked up once, and `calculateExtrasCharge`
 *   already establishes that we do not take the fare margin twice.
 *
 * - **Free.** No charge at all, and no handling fee either. Charging £15 to
 *   process a change the airline is doing for nothing invents a fee out of an
 *   absence, which is what we are supposedly not.
 *
 * - **Refund due.** The airline returns the difference. We do not deduct a
 *   handling fee from it — netting a fee out of someone's refund is how
 *   "refunded £40" becomes "£25 arrived", and that conversation costs more than
 *   the fee. `refund_to` may be airline credit rather than cash, which the
 *   caller must say plainly and this function does not decide.
 */
export function calculateChangeCharge(
  airlineChangeAmount: string,
  currency: string,
): ChangeBreakdown {
  const airline = Number(airlineChangeAmount);
  if (!Number.isFinite(airline)) {
    throw new Error(`Cannot price a change from "${airlineChangeAmount}".`);
  }

  if (airline < 0) {
    return {
      airlineAmount: airline.toFixed(2),
      handlingFee: '0.00',
      chargeAmount: '0.00',
      refundAmount: Math.abs(airline).toFixed(2),
      currency,
    };
  }

  if (airline === 0) {
    return {
      airlineAmount: '0.00',
      handlingFee: '0.00',
      chargeAmount: '0.00',
      refundAmount: null,
      currency,
    };
  }

  const fee = Number.isFinite(CHANGE_FEE) && CHANGE_FEE > 0 ? CHANGE_FEE : 0;
  const charge = (airline + fee) / (1 - ASSUMED_FEE_RATE);

  return {
    airlineAmount: airline.toFixed(2),
    handlingFee: fee.toFixed(2),
    chargeAmount: toMinorUnitCeil(charge),
    refundAmount: null,
    currency,
  };
}

export type CoverageVerdict = 'covered' | 'short' | 'unknown';

/**
 * Can this confirmed payment cover what the airline is owed?
 *
 * Three outcomes, not two. `net_amount` is null until Duffel has settled the
 * payment intent, and that can lag the `succeeded` status by moments. Reading
 * null as "short" refunds perfectly good payments — the same mistake as treating
 * a request timeout as a failed booking. Absence of information is not negative
 * information.
 */
export function coversFare(
  netAmount: string | null,
  supplierAmount: string,
): CoverageVerdict {
  if (netAmount === null) return 'unknown';
  const net = Number(netAmount);
  if (!Number.isFinite(net)) return 'unknown';
  return net + 0.001 >= Number(supplierAmount) ? 'covered' : 'short';
}

/**
 * Fallback when the net amount isn't known yet.
 *
 * We know what we charged and the rate we grossed up at, so we can establish a
 * lower bound on what must have landed. Conservative on purpose: it uses the
 * assumed (higher) fee rate, so it under-estimates rather than over.
 */
export function chargeCoversFare(
  chargeAmount: string,
  supplierAmount: string,
): boolean {
  const impliedNet = Number(chargeAmount) * (1 - ASSUMED_FEE_RATE);
  return impliedNet + 0.001 >= Number(supplierAmount);
}
