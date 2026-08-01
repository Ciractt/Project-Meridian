'use client';

import { formatDuration, formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Facets, Filters } from '../filters';
import { AirlineLogo } from './airline-logo';

interface FilterRailProps {
  facets: Facets;
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  onReset: () => void;
  activeCount: number;
  logos: Record<string, string | null>;
  /**
   * Render the "Filters / Clear n" heading. The desktop aside needs it; the
   * mobile sheet has its own header and reset control, so it doesn't.
   */
  headed?: boolean;
}

const STOP_LABELS: Record<number, string> = {
  0: 'Direct',
  1: '1 stop',
  2: '2+ stops',
};

export function FilterRail({
  facets,
  filters,
  onChange,
  onReset,
  activeCount,
  logos,
  headed = true,
}: FilterRailProps) {
  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  return (
    <div className="min-w-0 space-y-6 overflow-hidden">
      {headed ? (
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold tracking-tight">Filters</h2>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-airway underline underline-offset-2 hover:no-underline"
            >
              Clear {activeCount}
            </button>
          ) : null}
        </div>
      ) : null}

      <Group title="Stops">
        {/* An empty `stops` array means no restriction. Showing that as three
            unticked boxes reads as "nothing included", so the empty state
            renders as all-ticked and the first click subtracts. */}
        {facets.stopBuckets.map((bucket) => (
          <label
            key={bucket.stops}
            className="flex cursor-pointer items-center justify-between gap-3 py-1.5"
          >
            <span className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={
                  filters.stops.length === 0 || filters.stops.includes(bucket.stops)
                }
                onChange={() => {
                  const all = facets.stopBuckets.map((entry) => entry.stops);
                  const current = filters.stops.length === 0 ? all : filters.stops;
                  const next = toggle(current, bucket.stops);
                  // Unticking the last one would show nothing at all, which is
                  // never what someone means. Treat it as "back to all".
                  onChange({ stops: next.length === 0 ? [] : next });
                }}
                className="size-4 accent-[var(--color-chart)]"
              />
              <span className="text-sm text-ink">
                {STOP_LABELS[bucket.stops] ?? `${bucket.stops} stops`}
              </span>
            </span>
            <span className="tabular-nums text-xs text-ink-faint">
              from {formatMoney(String(bucket.cheapest), facets.currency)}
            </span>
          </label>
        ))}
      </Group>

      <Group title="Maximum price">
        <input
          type="range"
          min={Math.floor(facets.minPrice)}
          max={Math.ceil(facets.maxPrice)}
          step={1}
          value={filters.maxPrice ?? Math.ceil(facets.maxPrice)}
          onChange={(event) => onChange({ maxPrice: Number(event.target.value) })}
          aria-label="Maximum total price"
          className="w-full accent-[var(--color-chart)]"
        />
        <p className="mt-1 tabular-nums text-xs text-ink-muted">
          Up to{' '}
          {formatMoney(
            String(filters.maxPrice ?? Math.ceil(facets.maxPrice)),
            facets.currency,
          )}
        </p>
      </Group>

      <Group title="Outbound departure">
        <div className="flex items-center gap-3">
          <HourSelect
            label="From"
            value={filters.departFromHour}
            onChange={(hour) =>
              onChange({
                departFromHour: hour,
                departToHour: Math.max(hour, filters.departToHour),
              })
            }
          />
          <HourSelect
            label="To"
            value={filters.departToHour}
            onChange={(hour) =>
              onChange({
                departToHour: hour,
                departFromHour: Math.min(hour, filters.departFromHour),
              })
            }
          />
        </div>
      </Group>

      {facets.maxDuration > facets.minDuration ? (
        <Group title="Maximum journey time">
          <input
            type="range"
            min={facets.minDuration}
            max={facets.maxDuration}
            step={15}
            value={filters.maxDurationMinutes ?? facets.maxDuration}
            onChange={(event) =>
              onChange({ maxDurationMinutes: Number(event.target.value) })
            }
            aria-label="Maximum total journey time"
            className="w-full accent-[var(--color-chart)]"
          />
          <p className="mt-1 tabular-nums text-xs text-ink-muted">
            Up to {formatDuration(filters.maxDurationMinutes ?? facets.maxDuration)}
          </p>
        </Group>
      ) : null}

      <Group title="Airlines">
        <div className="max-h-64 min-w-0 space-y-0.5 overflow-x-hidden overflow-y-auto pr-1">
          {facets.airlines.map((airline) => (
            <label
              key={airline.code}
              className="flex min-w-0 cursor-pointer items-center justify-between gap-2 py-1.5"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.airlines.includes(airline.code)}
                  onChange={() =>
                    onChange({ airlines: toggle(filters.airlines, airline.code) })
                  }
                  className="size-4 shrink-0 accent-[var(--color-chart)]"
                />
                <AirlineLogo
                  src={logos[airline.code] ?? null}
                  name={airline.name}
                  code={airline.code}
                  size="sm"
                />
                <span className="truncate text-sm text-ink">{airline.name}</span>
              </span>
              <span className="max-w-20 shrink-0 truncate tabular-nums text-xs text-ink-faint">
                {formatMoney(String(airline.cheapest), facets.currency)}
              </span>
            </label>
          ))}
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-xs font-medium text-ink-faint">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <label className={cn('flex-1 text-xs text-ink-faint')}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-control border border-hairline-strong bg-surface px-2 py-1.5 tabular-nums text-sm text-ink"
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, '0')}:00
          </option>
        ))}
      </select>
    </label>
  );
}
