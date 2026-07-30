'use client';

import { cn } from '@/lib/cn';
import { formatDuration, formatMoney } from '@/lib/format';
import type { SortKey, Summary, SummaryEntry } from '../filters';

/**
 * On a return, the sum of both legs is a number nobody experiences — 6h 38m
 * isn't a journey, it's two journeys added together. The comparable figure is
 * the average leg, which is what other comparison sites show.
 */
function describeDuration(entry: SummaryEntry): string {
  if (entry.legs > 1) {
    return `${formatDuration(Math.round(entry.durationMinutes / entry.legs))} average leg`;
  }
  return `${formatDuration(entry.durationMinutes)} total`;
}

const TABS: Array<{ key: SortKey; label: string; hint: string }> = [
  { key: 'best', label: 'Best', hint: 'Price and journey time together' },
  { key: 'cheapest', label: 'Cheapest', hint: 'Lowest total price' },
  { key: 'fastest', label: 'Fastest', hint: 'Shortest total journey' },
];

/**
 * Sorting happens in memory over the already-fetched offers (ADR-013), so
 * these are plain state changes — no navigation, no second offer request.
 *
 * "Best" is a blended ranking rather than pure price, so the tab carries an
 * explanation of what it weighs. Opaque ranking on a price comparison is
 * exactly what regulators take an interest in.
 */
export function SortTabs({
  summary,
  currency,
  active,
  onChange,
}: {
  summary: Summary;
  currency: string;
  active: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Sort results"
      className="grid overflow-hidden rounded-card border border-hairline bg-surface sm:grid-cols-3"
    >
      {TABS.map((tab) => {
        const entry = summary[tab.key];
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            title={tab.hint}
            onClick={() => onChange(tab.key)}
            className={cn(
              'border-hairline p-4 text-left transition-colors not-last:border-b sm:not-last:border-r sm:not-last:border-b-0',
              isActive ? 'bg-night text-white' : 'hover:bg-paper',
            )}
          >
            <span
              className={cn(
                'block text-sm font-medium',
                isActive ? 'text-white' : 'text-ink',
              )}
            >
              {tab.label}
            </span>
            <span
              className={cn(
                'mt-1 block font-mono text-lg font-semibold',
                isActive ? 'text-white' : 'text-chart',
              )}
            >
              {entry ? formatMoney(entry.amount, currency) : '—'}
            </span>
            <span
              className={cn(
                'mt-0.5 block text-xs',
                isActive ? 'text-white/60' : 'text-ink-faint',
              )}
            >
              {entry ? describeDuration(entry) : 'No results'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
