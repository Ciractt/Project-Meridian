'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import type { PassengerCounts } from '../types';

interface PassengersFieldProps {
  value: PassengerCounts;
  onChange: (next: PassengerCounts) => void;
  cabin: string;
  onCabinChange: (next: string) => void;
  error?: string;
}

const CABIN_LABELS: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium economy',
  business: 'Business',
  first: 'First',
};

const ROWS = [
  { key: 'adults', label: 'Adults', hint: '12 and over', min: 1, max: 9 },
  { key: 'children', label: 'Children', hint: '2 to 11', min: 0, max: 8 },
  { key: 'infants', label: 'Infants', hint: 'Under 2, on a lap', min: 0, max: 8 },
] as const;

export function PassengersField({
  value,
  onChange,
  cabin,
  onCabinChange,
  error,
}: PassengersFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const total = value.adults + value.children + value.infants;

  return (
    <div ref={rootRef} className="relative h-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          'h-full w-full px-4 py-3 text-left transition-colors hover:bg-paper',
          error && 'bg-chart-wash',
        )}
      >
        <span className="block font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
          Travellers and cabin
        </span>
        <span className="mt-1 block truncate text-sm text-ink">
          {total} {total === 1 ? 'traveller' : 'travellers'}, {CABIN_LABELS[cabin]}
        </span>
      </button>

      {error ? (
        <p role="alert" className="absolute top-full left-0 mt-1 px-4 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {open ? (
        <div
          id={`${id}-panel`}
          className="absolute top-full right-0 z-30 mt-2 w-80 rounded-card border border-hairline bg-surface p-5 shadow-2xl shadow-ink/10"
        >
          {ROWS.map((row) => {
            const count = value[row.key];
            const singular = row.label.toLowerCase().replace(/s$/, '');
            return (
              <div
                key={row.key}
                className="flex items-center justify-between border-b border-hairline py-3 first:pt-0"
              >
                <span>
                  <span className="block text-sm text-ink">{row.label}</span>
                  <span className="block text-xs text-ink-faint">{row.hint}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Stepper
                    sign="−"
                    label={`Remove one ${singular}`}
                    disabled={count <= row.min}
                    onClick={() => onChange({ ...value, [row.key]: count - 1 })}
                  />
                  <output className="w-5 text-center font-mono text-sm">{count}</output>
                  <Stepper
                    sign="+"
                    label={`Add one ${singular}`}
                    disabled={count >= row.max}
                    onClick={() => onChange({ ...value, [row.key]: count + 1 })}
                  />
                </span>
              </div>
            );
          })}

          <label
            htmlFor={`${id}-cabin`}
            className="mt-4 block font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase"
          >
            Cabin
          </label>
          <select
            id={`${id}-cabin`}
            value={cabin}
            onChange={(event) => onCabinChange(event.target.value)}
            className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            {Object.entries(CABIN_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({
  sign,
  label,
  disabled,
  onClick,
}: {
  sign: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="size-8 rounded-full border border-hairline-strong text-ink transition-colors hover:border-ink disabled:border-hairline disabled:text-hairline-strong"
    >
      <span aria-hidden="true">{sign}</span>
    </button>
  );
}
