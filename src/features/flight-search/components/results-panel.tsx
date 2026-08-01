'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
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
import { FeatureOfferCard } from './feature-offer-card';
import { FilterRail } from './filter-rail';
import { FilterSheet } from './filter-sheet';
import { FilterPills } from './filter-pills';
import { SortSelect } from './sort-select';

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
  const [showAll, setShowAll] = useState(false);

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

  /* The picks, deduplicated. One offer routinely wins on more than one count,
     and three cards showing the same flight at the same price reads as a
     rendering fault — so the labels collect onto one card rather than the card
     repeating. Drawn from `visible`, so filtering also filters what gets
     promoted; a pick your own filters exclude would be the worst kind of
     recommendation. */
  const picks = useMemo(() => {
    const collected = new Map<string, { offer: Offer; labels: string[] }>();
    for (const key of ['best', 'cheapest', 'fastest'] as const) {
      const entry = summary[key];
      if (!entry) continue;
      const offer = visible.find((candidate) => candidate.id === entry.offerId);
      if (!offer) continue;
      const existing = collected.get(offer.id);
      if (existing) existing.labels.push(BADGES[key]);
      else collected.set(offer.id, { offer, labels: [BADGES[key]] });
    }
    return [...collected.values()];
  }, [summary, visible]);

  /* How many results the picks do not already account for. */
  const remainder = visible.length - picks.length;
  const listHidden = picks.length > 0 && remainder > 0 && !showAll;

  // Three identical figures side by side reads as a rendering fault. It is
  // usually just one flight winning on both counts, which is worth saying.
  const allOneOffer =
    summary.best !== null &&
    summary.best.offerId === summary.cheapest?.offerId &&
    summary.best.offerId === summary.fastest?.offerId;

  return (
    <div className="space-y-8">
      {/* Above the picks, because they filter the picks too — a selection drawn
          from results the traveller has excluded would be the worst kind of
          recommendation. */}
      <FilterPills
        facets={facets}
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      />

      {picks.length > 0 ? (
        <section aria-labelledby="picks-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <h2
                id="picks-heading"
                className="shrink-0 text-xs font-semibold tracking-[0.1em] text-ink-faint uppercase"
              >
                Our picks
              </h2>
              <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
            </div>
            {/* Each card names its own criterion; this is the part that says
                what does not go into it. ADR-013 — an unexplained ranking on a
                price comparison is a regulatory problem, not a design one. */}
            <p className="text-xs text-ink-faint">
              Chosen on price and journey time. Nothing here is paid placement.
            </p>
          </div>

          {/* Columns follow the number of picks. When one offer is the cheapest
              and the fastest and the best, the labels collapse onto a single
              card — correct, and it left two empty thirds of the page looking
              like something failed to load. */}
          <ul
            className={cn(
              'grid gap-4',
              picks.length === 1 && 'max-w-sm',
              picks.length === 2 && 'sm:grid-cols-2',
              picks.length >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
            )}
          >
            {picks.map((pick) => (
              <li key={pick.offer.id} className="flex flex-col">
                <FeatureOfferCard
                  offer={pick.offer}
                  travellers={travellers}
                  labels={pick.labels}
                />
              </li>
            ))}
          </ul>

          {listHidden ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-control border border-hairline-strong bg-surface px-6 py-3 text-sm font-medium text-airway transition-colors hover:border-airway"
              >
                Show all {visible.length} flights
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* The full list stays a list. A vertical card is the right shape for a
          pick and the wrong one for scanning forty of them, so the two are
          different components rather than one with a variant prop. */}
      <div
        className={cn(
          'grid gap-8 lg:grid-cols-[16rem_1fr]',
          listHidden && 'hidden',
        )}
      >
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <h2 className="shrink-0 text-xs font-semibold tracking-[0.1em] text-ink-faint uppercase">
              {picks.length > 0 ? 'More flights' : 'Flights'}
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          </div>
          <SortSelect
            active={filters.sort}
            onChange={(sort) => setFilters((current) => ({ ...current, sort }))}
          />
        </div>

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
    </div>
  );
}

const BADGES: Record<Filters['sort'], string> = {
  best: 'Best overall',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
};
