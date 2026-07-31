'use client';

import { useEffect, useRef, useState } from 'react';
import { FilterRail } from './filter-rail';
import type { Facets, Filters } from '../filters';

/**
 * The filter rail, as a sheet, below `lg`.
 *
 * On a narrow screen the rail is roughly 600px of stops, sliders, hour selects
 * and an airline list — all of it above the first flight, because it is the
 * first child of the results grid. Nobody scrolls past that to find out whether
 * we have any flights.
 *
 * Native `<dialog>` for the same reason as TripDetailsDialog: focus trapping,
 * Escape, inert background and the top layer are all correct for free, and a
 * hand-rolled overlay gets the visuals right and the focus wrong. It matches
 * the one modal already in the product rather than inventing a second pattern.
 *
 * Filtering is in-memory and synchronous (ADR-013), so changes apply live and
 * the count on the close button moves as you tick. There is no draft state and
 * no Apply step — an Apply button would imply a cost that isn't there.
 */
export function FilterSheet({
  facets,
  filters,
  logos,
  activeCount,
  matchCount,
  onChange,
  onReset,
}: {
  facets: Facets;
  filters: Filters;
  logos: Record<string, string | null>;
  activeCount: number;
  /** Offers currently passing the filters, for the close button. */
  matchCount: number;
  onChange: (next: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * The wrapper is `lg:hidden`, and `display: none` on an ancestor removes a
   * dialog's box even in the top layer — but it does not take it out of the top
   * layer. A tablet rotated into landscape with the sheet open would get an
   * invisible modal holding the rest of the page inert. Close on the crossing.
   *
   * 64rem is Tailwind's `lg`; it is the same number as the class above, and the
   * two have to stay in step.
   */
  useEffect(() => {
    const query = window.matchMedia('(min-width: 64rem)');
    function onCross(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    query.addEventListener('change', onCross);
    return () => query.removeEventListener('change', onCross);
  }, []);

  return (
    <div className="mt-3 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3 text-sm font-medium text-ink"
      >
        <span className="flex items-center gap-2">
          Filters
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-chart font-mono text-[10px] text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="font-mono text-xs text-ink-faint">
          {matchCount} {matchCount === 1 ? 'flight' : 'flights'}
        </span>
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label="Filter results"
        /* Clicking the backdrop closes. A click on ::backdrop hit-tests as a
           click on the dialog element itself, so the target check is what
           separates "outside the panel" from "on something in it" — it holds
           because these dialogs have p-0 and their content fills them. */
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        /* Anchored to the bottom rather than centred: on a phone this is a
           sheet, and the controls should sit where the thumb already is.
           `mt-auto` supplies the top margin the UA's `margin: auto` would
           otherwise split evenly — Tailwind's preflight resets both.

           `open:flex` rather than `flex`, or the closed dialog renders. */
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card rounded-b-none bg-surface p-0 backdrop:bg-ink/50 open:flex open:flex-col sm:m-auto sm:max-w-md sm:rounded-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline px-5 py-4">
          <h2 className="font-display text-base font-bold tracking-tight">Filters</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="flex size-8 items-center justify-center rounded-full border border-hairline text-ink-muted hover:border-ink hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FilterRail
            facets={facets}
            filters={filters}
            logos={logos}
            activeCount={activeCount}
            onChange={onChange}
            onReset={onReset}
            headed={false}
          />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-hairline px-5 py-4">
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="rounded-control border border-hairline-strong px-4 py-2.5 text-sm font-medium text-ink disabled:text-ink-faint"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-white"
          >
            {matchCount === 1 ? 'Show 1 flight' : `Show ${matchCount} flights`}
          </button>
        </div>
      </dialog>
    </div>
  );
}
