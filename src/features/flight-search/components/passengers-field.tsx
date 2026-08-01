'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import type { PassengerSelection } from '../types';

interface PassengersFieldProps {
  value: PassengerSelection;
  onChange: (next: PassengerSelection) => void;
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

/** Under this on the day of travel and they're on a lap, not a seat. */
const LAP_INFANT_AGE = 2;

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

  const total = value.adults + value.childAges.length;

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
        <span className="block text-xs font-medium text-ink-faint">
          Who’s travelling?
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
          /* See PlaceField — a fixed 20rem overflows the card below `lg`. */
          className="absolute top-full right-0 z-30 mt-2 w-full rounded-card border border-hairline bg-surface p-5 shadow-2xl shadow-ink/10 lg:w-80"
        >
          <div className="flex items-center justify-between border-b border-hairline py-3 first:pt-0">
            <span>
              <span className="block text-sm text-ink">Adults</span>
              <span className="block text-xs text-ink-faint">18 and over</span>
            </span>
            <span className="flex items-center gap-3">
              <Stepper
                sign="−"
                label="Remove one adult"
                disabled={value.adults <= 1}
                onClick={() => onChange({ ...value, adults: value.adults - 1 })}
              />
              <output className="w-5 text-center tabular-nums text-sm">
                {value.adults}
              </output>
              <Stepper
                sign="+"
                label="Add one adult"
                disabled={value.adults >= 9}
                onClick={() => onChange({ ...value, adults: value.adults + 1 })}
              />
            </span>
          </div>

          <div className="border-b border-hairline py-3">
            <div className="flex items-center justify-between">
              <span>
                <span className="block text-sm text-ink">Under 18s</span>
                <span className="block text-xs text-ink-faint">
                  We ask their age, not a category
                </span>
              </span>
              <span className="flex items-center gap-3">
                <Stepper
                  sign="−"
                  label="Remove one child"
                  disabled={value.childAges.length === 0}
                  onClick={() =>
                    onChange({ ...value, childAges: value.childAges.slice(0, -1) })
                  }
                />
                <output className="w-5 text-center tabular-nums text-sm">
                  {value.childAges.length}
                </output>
                <Stepper
                  sign="+"
                  label="Add one child"
                  disabled={value.childAges.length >= 8}
                  onClick={() =>
                    onChange({ ...value, childAges: [...value.childAges, 8] })
                  }
                />
              </span>
            </div>

            {value.childAges.length > 0 ? (
              <>
                <p className="mt-3 text-xs text-ink-faint">
                  Age when they travel. Airlines disagree about where childhood ends,
                  so we pass the age and let each one apply its own rules.
                </p>
                <ul className="mt-2 space-y-2">
                  {value.childAges.map((age: number, index: number) => (
                    <li key={index} className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={`${id}-child-${index}`}
                        className="text-sm text-ink-muted"
                      >
                        Child {index + 1}
                        {age < LAP_INFANT_AGE ? (
                          <span className="ml-1 text-xs text-ink-faint">(on a lap)</span>
                        ) : null}
                      </label>
                      <select
                        id={`${id}-child-${index}`}
                        value={age}
                        onChange={(event) => {
                          const next = [...value.childAges];
                          next[index] = Number(event.target.value);
                          onChange({ ...value, childAges: next });
                        }}
                        className="rounded-control border border-hairline-strong bg-surface px-2 py-1.5 text-sm"
                      >
                        {Array.from({ length: 18 }, (_, years) => (
                          <option key={years} value={years}>
                            {years === 0 ? 'Under 1' : `${years}`}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <label
            htmlFor={`${id}-cabin`}
            className="mt-4 block text-xs font-medium text-ink-faint"
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
