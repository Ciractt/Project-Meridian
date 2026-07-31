'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarMonth } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  addDays,
  addMonths,
  formatShort,
  monthOf,
  todayKey,
  type DateKey,
  type MonthKey,
} from '@/lib/date';

interface DateRangeFieldProps {
  tripType: 'return' | 'one-way';
  departureDate: DateKey;
  returnDate: DateKey;
  onChange: (next: { departureDate: DateKey; returnDate: DateKey }) => void;
  error?: string;
}

/**
 * Two-month range picker.
 *
 * Replaces the native <input type="date">, which can only take one date at a
 * time, gives no view of the surrounding month, and renders differently in
 * every browser. Choosing flights is a comparison task — people want to see
 * the weekend either side — so the calendar has to be visible, wide and ours.
 *
 * Keyboard model follows the ARIA date-picker pattern: arrows move by day,
 * PageUp/PageDown by month, Home/End to week edges, Enter selects, Escape
 * closes and returns focus to the trigger.
 */
export function DateRangeField({
  tripType,
  departureDate,
  returnDate,
  onChange,
  error,
}: DateRangeFieldProps) {
  const min = todayKey();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<MonthKey>(
    monthOf(departureDate || min),
  );
  const [focused, setFocused] = useState<DateKey>(departureDate || min);
  const [hovered, setHovered] = useState<DateKey | undefined>();
  /** Which end of the range the next click sets. */
  const [picking, setPicking] = useState<'departure' | 'return'>('departure');

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setHovered(undefined);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHovered(undefined);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Move real DOM focus to the focused day so screen readers follow along.
  useLayoutEffect(() => {
    if (!open) return;
    const cell = panelRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${focused}"]`,
    );
    cell?.focus({ preventScroll: true });
  }, [focused, open, visibleMonth]);

  function moveFocus(next: DateKey) {
    if (next < min) return;
    setFocused(next);
    const month = monthOf(next);
    if (month !== visibleMonth && month !== addMonths(visibleMonth, 1)) {
      setVisibleMonth(month);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const key = event.key;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (key in moves) {
      event.preventDefault();
      moveFocus(addDays(focused, moves[key] ?? 0));
    } else if (key === 'PageUp') {
      event.preventDefault();
      moveFocus(addDays(focused, -28));
    } else if (key === 'PageDown') {
      event.preventDefault();
      moveFocus(addDays(focused, 28));
    } else if (key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function select(date: DateKey) {
    if (tripType === 'one-way') {
      onChange({ departureDate: date, returnDate: '' });
      close();
      return;
    }

    if (picking === 'departure' || date < departureDate) {
      onChange({ departureDate: date, returnDate: '' });
      setPicking('return');
      setFocused(date);
      return;
    }

    onChange({ departureDate, returnDate: date });
    setPicking('departure');
    close();
  }

  const summary =
    tripType === 'one-way'
      ? departureDate
        ? formatShort(departureDate)
        : 'Add date'
      : departureDate && returnDate
        ? `${formatShort(departureDate)} – ${formatShort(returnDate)}`
        : departureDate
          ? `${formatShort(departureDate)} – Add return`
          : 'Add dates';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          setPicking(tripType === 'one-way' || !departureDate ? 'departure' : 'return');
          setVisibleMonth(monthOf(departureDate || min));
          setFocused(departureDate || min);
        }}
        className={cn(
          'h-full w-full px-4 py-3 text-left transition-colors hover:bg-paper',
          error && 'bg-chart-wash',
        )}
      >
        <span className="block text-xs font-medium text-ink-faint">When?</span>
        <span
          className={cn(
            'mt-1 block truncate text-sm',
            departureDate ? 'text-ink' : 'text-ink-faint',
          )}
        >
          {summary}
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Choose dates"
          onKeyDown={onKeyDown}
          /* Width is deliberately not a fixed measurement below `md`. Until the
             search bar becomes a row at `lg`, this field is a full-width segment
             of the card, so `w-full` is exactly the space available — no
             arithmetic against the viewport, and nothing to get wrong at 360px.
             The old `w-[22rem]` (352px) was wider than the card on any handset
             narrower than an iPhone 12, and `sm:w-[38rem]` overflowed a 640px
             window by 8px. At `lg` the segment shrinks to a grid cell, so the
             panel anchors right to keep it inside a 1024px window. */
          className="absolute top-full left-0 z-30 mt-2 w-full rounded-card border border-hairline bg-surface p-4 shadow-2xl shadow-ink/10 sm:p-6 md:w-[38rem] lg:left-auto lg:right-0"
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={visibleMonth <= monthOf(min)}
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              className="flex size-9 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-ink-faint disabled:border-hairline disabled:text-hairline-strong"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <p className="text-xs text-ink-faint" aria-live="polite">
              {tripType === 'one-way'
                ? 'Choose your departure date'
                : picking === 'departure'
                  ? 'Choose your departure date'
                  : 'Now choose your return'}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              className="flex size-9 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-ink-faint"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="flex gap-6">
            <CalendarMonth
              month={visibleMonth}
              start={departureDate || undefined}
              end={returnDate || undefined}
              min={min}
              focused={focused}
              onSelect={select}
              onFocus={setFocused}
              hovered={hovered}
              onHover={setHovered}
            />
            {/* Second month is the whole point on desktop; hidden on narrow
                screens where it would be unreadable rather than shrunk. */}
            <div className="hidden flex-1 sm:block">
              <CalendarMonth
                month={addMonths(visibleMonth, 1)}
                start={departureDate || undefined}
                end={returnDate || undefined}
                min={min}
                focused={focused}
                onSelect={select}
                onFocus={setFocused}
                hovered={hovered}
                onHover={setHovered}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => {
                onChange({ departureDate: '', returnDate: '' });
                setPicking('departure');
              }}
              className="text-xs text-airway underline underline-offset-2 hover:no-underline"
            >
              Clear dates
            </button>
            <Button type="button" size="md" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="absolute top-full left-0 mt-1 px-4 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
