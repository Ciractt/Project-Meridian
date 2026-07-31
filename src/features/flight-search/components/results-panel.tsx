'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  applyFilters,
  buildSummary,
  countActiveFilters,
  defaultFilters,
  deriveFacets,
  sortOffers,
  type Filters,
} from '../filters';
import type { Offer } from '../types';
import { OfferCard } from './offer-card';
import { FilterRail } from './filter-rail';
import { FilterSheet } from './filter-sheet';
import { SortTabs } from './sort-tabs';

/**
 * Owns filter and sort state for a result set (ADR-013).
 *
 * The server fetched these offers once. Everything from here — faceting,
 * filtering, ranking — is in-memory and synchronous, so interaction is instant
 * and no amount of filtering costs another Duffel offer request.
 */
export function ResultsPanel({
  offers,
  travellers,
  logos,
  cached,
}: {
  offers: Offer[];
  travellers: number;
  logos: Record<string, string | null>;
  /** Served from the search cache rather than a fresh airline search. */
  cached: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  // Facets come from the unfiltered set so the rail never shrinks while you
  // read it. Memoised because it walks every offer.
  const facets = useMemo(() => deriveFacets(offers), [offers]);

  const visible = useMemo(() => {
    const filtered = applyFilters(offers, filters);
    return sortOffers(filtered, filters.sort);
  }, [offers, filters]);

  const summary = useMemo(
    () => buildSummary(applyFilters(offers, filters)),
    [offers, filters],
  );

  const activeCount = countActiveFilters(filters, facets);

  // Three identical figures side by side reads as a rendering fault. It is
  // usually just one flight winning on both counts, which is worth saying.
  const allOneOffer =
    summary.best !== null &&
    summary.best.offerId === summary.cheapest?.offerId &&
    summary.best.offerId === summary.fastest?.offerId;

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      {/* Below `lg` this grid is a single column and the aside is its first
          child, so the rail — six controls and an airline list, call it 600px —
          sat between the traveller and the first flight. It moves into a sheet
          at that width; see FilterSheet. ResultsSkeleton already assumed this,
          which was the tell. */}
      <aside
        aria-label="Filter results"
        className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start"
      >
        <FilterRail
          facets={facets}
          filters={filters}
          logos={logos}
          activeCount={activeCount}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
      </aside>

      <div className="min-w-0">
        <SortTabs
          summary={summary}
          currency={facets.currency}
          active={filters.sort}
          onChange={(sort) => setFilters((current) => ({ ...current, sort }))}
        />

        <FilterSheet
          facets={facets}
          filters={filters}
          logos={logos}
          activeCount={activeCount}
          matchCount={visible.length}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />

        {visible.length === 0 ? (
          <div className="mt-4 rounded-card border border-hairline bg-surface p-8 text-center">
            <h2 className="font-display text-lg font-bold tracking-tight">
              No flights match these filters.
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {offers.length} {offers.length === 1 ? 'flight is' : 'flights are'}{' '}
              available on this route.{' '}
              <button
                type="button"
                onClick={() => setFilters(defaultFilters)}
                className="text-airway underline underline-offset-2 hover:no-underline"
              >
                Clear filters
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs text-ink-faint" role="status">
                Showing {visible.length} of {offers.length}. Prices include taxes and
                airline charges.
              </p>
              {allOneOffer ? (
                <p className="text-xs text-positive">
                  The cheapest flight is also the fastest.
                </p>
              ) : filters.sort === 'best' ? (
                <p className="text-xs text-ink-faint">
                  Best weighs price and journey time. Nothing here is paid placement.
                </p>
              ) : null}
            </div>

            <ul className="space-y-3">
              {visible.map((offer, index) => (
                <li key={offer.id}>
                  <OfferCard
                    offer={offer}
                    travellers={travellers}
                    badge={index === 0 ? BADGES[filters.sort] : undefined}
                  />
                </li>
              ))}
            </ul>

            <p className="mt-6 text-center text-xs text-ink-faint">
              {cached
                ? 'These fares were found moments ago and may have moved since. '
                : 'Fares can move between search and booking. '}
              We re-check the price before you pay.{' '}
              <Link href="/" className="text-airway underline underline-offset-2">
                Start a new search
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const BADGES: Record<Filters['sort'], string> = {
  best: 'Best overall',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
};
