'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { searchPlaces } from '../airports';
import type { Place } from '../types';

interface PlaceFieldProps {
  label: string;
  name: string;
  value: string;
  /** What the traveller sees once a place is chosen, e.g. "Newcastle (NCL)". */
  display: string;
  onChange: (place: { code: string; display: string }) => void;
  error?: string;
  placeholder?: string;
}

/**
 * Airport combobox, styled as a segment of the search bar.
 *
 * Implements the ARIA 1.2 combobox pattern directly (see ADR-005). Data comes
 * from `searchPlaces`, which hits Duffel via /api/places and falls back to a
 * bundled list if that fails, so the field is never dead.
 */
export function PlaceField({
  label,
  name,
  value,
  display,
  onChange,
  error,
  placeholder,
}: PlaceFieldProps) {
  const id = useId();
  const listId = `${id}-listbox`;

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !editing) return;
    let cancelled = false;
    setPending(true);
    const timer = setTimeout(() => {
      void searchPlaces(query).then((lookup) => {
        if (cancelled) return;
        setResults(lookup.places);
        setDegraded(lookup.source === 'fallback');
        setActive(0);
        setPending(false);
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, editing]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function select(place: Place) {
    onChange({
      code: place.iataCode,
      display: `${place.city} (${place.iataCode})`,
    });
    setQuery('');
    setEditing(false);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      const chosen = results[active];
      if (chosen) {
        event.preventDefault();
        select(chosen);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setEditing(false);
      setQuery('');
    }
  }

  return (
    <div ref={rootRef} className="relative h-full">
      <div
        className={cn(
          'h-full px-4 py-3 transition-colors',
          error ? 'bg-chart-wash' : 'hover:bg-paper',
        )}
      >
        <label
          htmlFor={id}
          className="block text-xs font-medium text-ink-faint"
        >
          {label}
        </label>
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          value={editing ? query : display}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={(event) => {
            setEditing(true);
            setQuery('');
            setOpen(true);
            event.target.select();
          }}
          onKeyDown={onKeyDown}
          className="mt-1 w-full truncate border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <input type="hidden" name={name} value={value} />

      {error ? (
        <p role="alert" className="absolute top-full left-0 mt-1 px-4 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          /* Full width of the segment until the bar becomes a row at `lg`. A
             fixed 20rem is wider than the card on a 360px handset. */
          className="absolute top-full left-0 z-30 mt-2 max-h-80 w-full overflow-auto rounded-card border border-hairline bg-surface py-1 shadow-2xl shadow-ink/10 lg:w-80"
        >
          {pending && results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-faint">Searching…</li>
          ) : null}

          {!pending && query.trim().length < 2 ? (
            <li className="px-4 py-3 text-sm text-ink-faint">
              Type a city or airport code.
            </li>
          ) : null}

          {!pending && query.trim().length >= 2 && results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-faint">
              Nothing matches “{query.trim()}”. Try a city name or a three-letter code.
            </li>
          ) : null}

          {/* Say when the answer came from the short bundled list rather than the
              live one. Otherwise a failing lookup and an unknown airport look
              identical from here. */}
          {degraded && !pending ? (
            <li className="border-t border-hairline px-4 py-2 text-xs text-caution">
              Airport search is temporarily unavailable — showing a shorter list.
            </li>
          ) : null}

          {results.map((place, index) => (
            <li key={place.iataCode}>
              <button
                type="button"
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(place)}
                className={cn(
                  'flex w-full items-baseline gap-3 px-4 py-2.5 text-left',
                  index === active ? 'bg-chart-wash' : 'bg-transparent',
                )}
              >
                <span className="w-9 shrink-0 tabular-nums text-sm font-semibold text-chart">
                  {place.iataCode}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {place.city}
                    {place.isCity ? ' — all airports' : ''}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {place.name}
                    {place.countryCode ? `, ${place.countryCode}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
