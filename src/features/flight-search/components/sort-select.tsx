'use client';

import { ArrowUpDown } from 'lucide-react';
import type { SortKey } from '../filters';

const OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'best', label: 'Best overall' },
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'fastest', label: 'Fastest' },
];

/**
 * How the list is ordered.
 *
 * This replaced three large tabs carrying the cheapest, fastest and best
 * prices. Those figures now sit on the picks above, so the tabs were showing
 * the same three numbers twice — and a control that repeats the content above
 * it is worse than a small one that doesn't.
 *
 * Sorting is in-memory over offers already fetched (ADR-013), so this is a
 * plain state change: no navigation, no second offer request, no cost.
 *
 * The disclosure that used to hang off these tabs in a `title` attribute has
 * moved to the picks header, where it is readable — a `title` never appears on
 * a touch device, which is most of the traffic, so the ranking explanation was
 * effectively desktop-only.
 */
export function SortSelect({
  active,
  onChange,
}: {
  active: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-faint">
      <span className="shrink-0">Sort by</span>
      <span className="relative flex items-center">
        <ArrowUpDown
          aria-hidden="true"
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 text-ink-faint"
        />
        <select
          value={active}
          onChange={(event) => onChange(event.target.value as SortKey)}
          className="appearance-none rounded-control border border-hairline-strong bg-surface py-2 pr-8 pl-9 text-sm font-medium text-ink"
        >
          {OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 text-xs text-ink-faint"
        >
          ▾
        </span>
      </span>
    </label>
  );
}
