import { describe, expect, it } from 'vitest';
import { applyFilters, defaultFilters, deriveFacets } from './filters';
import type { Offer } from './types';

/**
 * The bag filters are the only ones that hide a result on the strength of
 * something we do not know, so their treatment of `unknown` is worth pinning
 * down: it must never be read as zero, and it must never be read as one.
 */
function offer(
  id: string,
  carryOn: number | 'unknown',
  checked: number | 'unknown',
): Offer {
  return {
    id,
    baggage: { carryOn, checked },
    totalAmountValue: 100,
    totalDurationMinutes: 120,
    maxStops: 0,
    outboundDepartureHour: 9,
    airlineCode: 'BA',
    airline: 'British Airways',
    currency: 'GBP',
  } as unknown as Offer;
}

const offers = [
  offer('has-both', 1, 1),
  offer('cabin-only', 1, 0),
  offer('nothing', 0, 0),
  offer('unknown-both', 'unknown', 'unknown'),
];

describe('bag filters', () => {
  it('are off by default and hide nothing', () => {
    expect(applyFilters(offers, defaultFilters)).toHaveLength(4);
  });

  it('keep only fares that state an included cabin bag', () => {
    const kept = applyFilters(offers, { ...defaultFilters, carryOnIncluded: true });
    expect(kept.map((o) => o.id)).toEqual(['has-both', 'cabin-only']);
  });

  it('treat unknown as not-included rather than as included', () => {
    const kept = applyFilters(offers, { ...defaultFilters, checkedBagIncluded: true });
    expect(kept.map((o) => o.id)).toEqual(['has-both']);
  });

  it('count what is included and what is unstated, so the UI can say so', () => {
    const facets = deriveFacets(offers);
    expect(facets.bags).toEqual({
      carryOnIncluded: 2,
      carryOnUnknown: 1,
      checkedIncluded: 1,
      checkedUnknown: 1,
    });
  });
});
