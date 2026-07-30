import { describe, it, expect } from 'vitest';
import {
  calculateCharge,
  chargeCoversFare,
  coversFare,
  extrasMarginRate,
} from './pricing';

/**
 * Tests for the pricing boundary.
 *
 * This is the first code in the repo under test, and it earns it: every amount
 * here is money, and the failure mode of a mistake is a quiet loss on every
 * booking rather than a visible break. The rates are pinned to their defaults in
 * vitest.config.ts (fare 5%, extras 15%, assumed fee 2.9%), so the exact figures
 * below are arithmetic, not magic numbers.
 */

// Pinned in vitest.config.ts. Used only by the property tests; the exact-value
// tests hard-code hand-verified results so a formula change is caught.
const FARE_MARGIN = 0.05;
const EXTRAS_MARGIN = 0.15;
const FEE = 0.029;

describe('calculateCharge — the gross-up', () => {
  it('grosses a fare up by margin and the assumed fee, dividing not multiplying', () => {
    // margin = 100 * 0.05 = 5; charge = (100 + 5) / (1 - 0.029) = 108.1359… -> ceil
    const bd = calculateCharge('100.00', 'GBP');
    expect(bd).toEqual({
      fareAmount: '100.00',
      extrasAmount: '0.00',
      supplierAmount: '100.00',
      marginAmount: '5.00',
      chargeAmount: '108.14',
      currency: 'GBP',
    });
  });

  it('rounds the charge UP to the cent, never down into margin', () => {
    // (97 + 4.85) / 0.971 = 104.89186…  Ceil gives 104.90; round-half would give
    // 104.89 and quietly under-collect. This case only passes with ceil.
    const bd = calculateCharge('97.00', 'GBP');
    expect(bd.chargeAmount).toBe('104.90');
    expect(bd.marginAmount).toBe('4.85');

    // The ceiled charge is at most one cent above the raw grossed-up figure.
    const raw = (97 + 4.85) / (1 - FEE);
    expect(Number(bd.chargeAmount)).toBeGreaterThanOrEqual(raw);
    expect(Number(bd.chargeAmount) - raw).toBeLessThan(0.01);
  });

  it('applies the two margins separately to fare and extras', () => {
    // fare margin 200*0.05=10, extras margin 50*0.15=7.5, total 17.5
    // charge = (250 + 17.5) / 0.971 = 275.4891… -> 275.49
    const bd = calculateCharge('200.00', 'EUR', '50.00');
    expect(bd).toEqual({
      fareAmount: '200.00',
      extrasAmount: '50.00',
      supplierAmount: '250.00',
      marginAmount: '17.50',
      chargeAmount: '275.49',
      currency: 'EUR',
    });
  });

  it('defaults extras to zero when omitted', () => {
    const bd = calculateCharge('150', 'GBP');
    expect(bd.extrasAmount).toBe('0.00');
    // Margin comes from the fare alone.
    expect(bd.marginAmount).toBe((150 * FARE_MARGIN).toFixed(2));
  });

  it('normalises fare and currency in the breakdown', () => {
    const bd = calculateCharge('150', 'usd' as string);
    expect(bd.fareAmount).toBe('150.00');
    expect(bd.currency).toBe('usd');
  });

  it('the extras margin matches extrasMarginRate() — the number Duffel marks bags up by', () => {
    // ADR-029: the component markup and calculateCharge must use one rate, or the
    // bag price shown mid-checkout disagrees with what it adds to the total.
    const fareOnly = Number(calculateCharge('100.00', 'GBP', '0.00').marginAmount);
    const withBag = Number(calculateCharge('100.00', 'GBP', '80.00').marginAmount);
    expect(withBag - fareOnly).toBeCloseTo(80 * extrasMarginRate(), 10);
  });

  describe('rejects inputs that can only produce a wrong price', () => {
    it.each(['0', '0.00', '-10', 'abc', '', 'NaN', 'Infinity'])(
      'throws on fare %j',
      (fare) => {
        expect(() => calculateCharge(fare, 'GBP')).toThrow();
      },
    );

    it.each(['-1', '-0.01', 'abc', 'NaN'])('throws on extras %j', (extras) => {
      expect(() => calculateCharge('100.00', 'GBP', extras)).toThrow();
    });

    it('allows zero extras', () => {
      expect(() => calculateCharge('100.00', 'GBP', '0')).not.toThrow();
    });
  });

  describe('invariants across a range of fares and extras', () => {
    const fares = [1, 12.34, 100, 401.89, 999.99, 5000];
    const extrasSet = [0, 0.5, 25, 60, 250];

    for (const fare of fares) {
      for (const extras of extrasSet) {
        const label = `fare ${fare}, extras ${extras}`;
        const bd = calculateCharge(fare.toFixed(2), 'GBP', extras.toFixed(2));

        it(`supplier is fare + extras — ${label}`, () => {
          expect(Number(bd.supplierAmount)).toBeCloseTo(fare + extras, 2);
        });

        it(`margin is the two rates applied separately — ${label}`, () => {
          // marginAmount is rounded to the cent, so tolerate up to half a cent
          // against the unrounded product (a wrong rate misses by whole cents).
          const expected = fare * FARE_MARGIN + extras * EXTRAS_MARGIN;
          expect(Math.abs(Number(bd.marginAmount) - expected)).toBeLessThanOrEqual(
            0.005 + 1e-9,
          );
        });

        it(`net after the fee still covers the supplier — ${label}`, () => {
          // The binding money-safety constraint: net >= fare + extras. Since the
          // charge is grossed up from (supplier + margin), the net must clear the
          // supplier with the margin to spare.
          const net = Number(bd.chargeAmount) * (1 - FEE);
          expect(net).toBeGreaterThanOrEqual(Number(bd.supplierAmount) - 1e-9);
        });

        it(`our own charge always passes the unknown-net fallback — ${label}`, () => {
          // completeBooking falls back to chargeCoversFare when net_amount is null.
          // A charge we computed must never fail its own coverage check.
          expect(chargeCoversFare(bd.chargeAmount, bd.supplierAmount)).toBe(true);
        });
      }
    }

    it('the charge grows monotonically with the fare', () => {
      let previous = 0;
      for (const fare of [10, 50, 100, 500, 1000]) {
        const charge = Number(calculateCharge(fare.toFixed(2), 'GBP').chargeAmount);
        expect(charge).toBeGreaterThan(previous);
        previous = charge;
      }
    });
  });
});

describe('coversFare — three outcomes, not two', () => {
  it('is unknown when net_amount is null (settlement lag, not a shortfall)', () => {
    expect(coversFare(null, '100.00')).toBe('unknown');
  });

  it('is unknown when net_amount is not a finite number', () => {
    expect(coversFare('abc', '100.00')).toBe('unknown');
    expect(coversFare('NaN', '100.00')).toBe('unknown');
  });

  it('is covered when net meets the supplier exactly', () => {
    expect(coversFare('100.00', '100.00')).toBe('covered');
  });

  it('is covered when net clears the supplier', () => {
    expect(coversFare('250.00', '100.00')).toBe('covered');
  });

  it('is short when net falls below the supplier beyond the float tolerance', () => {
    expect(coversFare('99.99', '100.00')).toBe('short');
  });

  it('tolerates a sub-tenth-penny float gap rather than refunding a good payment', () => {
    // net_amount arriving a hair light on rounding is not a real shortfall.
    expect(coversFare('99.9995', '100.00')).toBe('covered');
  });
});

describe('chargeCoversFare — the conservative fallback', () => {
  it('confirms coverage from the charge when the implied net clears the supplier', () => {
    expect(chargeCoversFare('108.14', '100.00')).toBe(true);
  });

  it('refuses when the implied net falls short', () => {
    // 102.90 * 0.971 = 99.9159 -> below 100
    expect(chargeCoversFare('102.90', '100.00')).toBe(false);
  });

  it('sits just the right side of the boundary', () => {
    // 103.00 * 0.971 = 100.013 -> clears
    expect(chargeCoversFare('103.00', '100.00')).toBe(true);
  });

  it('under-estimates by using the assumed (higher) fee rate', () => {
    // The implied net it computes is never more than the real net could be, so a
    // true here is safe: charge * (1 - assumedFee) <= charge * (1 - realFee).
    const charge = 200;
    const impliedNet = charge * (1 - FEE);
    expect(chargeCoversFare(charge.toFixed(2), impliedNet.toFixed(2))).toBe(true);
    // A supplier a penny above the implied net is refused.
    expect(chargeCoversFare(charge.toFixed(2), (impliedNet + 0.01).toFixed(2))).toBe(
      false,
    );
  });
});

describe('extrasMarginRate', () => {
  it('exposes the pinned extras rate', () => {
    expect(extrasMarginRate()).toBe(EXTRAS_MARGIN);
  });
});
