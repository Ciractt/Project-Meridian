'use client';

import { cn } from '@/lib/cn';
import type { Facets, Filters } from '../filters';

/**
 * The two or three filters people actually reach for, always visible.
 *
 * The rail holds everything; this holds the handful that get used on most
 * searches, so they stop being one tap behind a sheet on mobile and one glance
 * away on desktop.
 *
 * Direct drives `filters.stops` rather than carrying a flag of its own. Two
 * controls writing the same idea into two places is how they end up
 * disagreeing — tick Direct here and the rail's stop list shows it, because it
 * is the same state.
 *
 * **The bag pills hide fares we know nothing about, and say so.** `unknown` is
 * a distinct state from zero, and a pill reading "Cabin bag included" cannot
 * honestly keep a fare whose allowance the airline never told us. But it
 * cannot quietly drop them either: that is a filter making a claim about
 * fares it has no information on. So when one is active and unknowns exist,
 * the row says how many were set aside and why. A pill nobody can use is
 * hidden entirely rather than shown returning nothing.
 */
export function FilterPills({
  facets,
  filters,
  onChange,
}: {
  facets: Facets;
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  const directOnly = filters.stops.length === 1 && filters.stops[0] === 0;
  const directCount =
    facets.stopBuckets.find((bucket) => bucket.stops === 0)?.count ?? 0;

  /* Only worth offering where it would change the set. A pill that filters
     nothing is noise; one that would empty the list is a trap. */
  const showDirect = directCount > 0 && directCount < countAll(facets);
  const showCarryOn = facets.bags.carryOnIncluded > 0;
  const showChecked = facets.bags.checkedIncluded > 0;

  if (!showDirect && !showCarryOn && !showChecked) return null;

  const setAside =
    (filters.carryOnIncluded ? facets.bags.carryOnUnknown : 0) +
    (filters.checkedBagIncluded ? facets.bags.checkedUnknown : 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {showDirect ? (
          <Pill
            active={directOnly}
            onClick={() => onChange({ stops: directOnly ? [] : [0] })}
          >
            Direct only
          </Pill>
        ) : null}

        {showCarryOn ? (
          <Pill
            active={filters.carryOnIncluded}
            onClick={() => onChange({ carryOnIncluded: !filters.carryOnIncluded })}
          >
            Cabin bag included
          </Pill>
        ) : null}

        {showChecked ? (
          <Pill
            active={filters.checkedBagIncluded}
            onClick={() =>
              onChange({ checkedBagIncluded: !filters.checkedBagIncluded })
            }
          >
            Checked bag included
          </Pill>
        ) : null}
      </div>

      {setAside > 0 ? (
        <p className="mt-2 text-xs text-ink-faint">
          {setAside === 1
            ? '1 fare is hidden because the airline didn’t tell us its allowance.'
            : `${setAside} fares are hidden because the airline didn’t tell us their allowance.`}{' '}
          They may well include a bag — we can’t say.
        </p>
      ) : null}
    </div>
  );
}

function countAll(facets: Facets): number {
  return facets.stopBuckets.reduce((total, bucket) => total + bucket.count, 0);
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-accent bg-accent text-white'
          : 'border-hairline-strong bg-surface text-ink hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}
