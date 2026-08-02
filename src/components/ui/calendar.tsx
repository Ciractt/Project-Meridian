'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import {
  dayOfMonth,
  formatFull,
  monthGrid,
  monthLabel,
  type DateKey,
  type MonthKey,
} from '@/lib/date';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

interface CalendarProps {
  month: MonthKey;
  start?: DateKey;
  end?: DateKey;
  min: DateKey;
  focused: DateKey;
  onSelect: (date: DateKey) => void;
  onFocus: (date: DateKey) => void;
  /** Preview highlight while the traveller is picking a return date. */
  hovered?: DateKey;
  onHover?: (date: DateKey | undefined) => void;
}

/**
 * One month of a date grid.
 *
 * Built on a real <table> with role="grid": screen readers announce the column
 * header, and the row/cell structure is what assistive tech expects from a
 * calendar. Only one cell is tabbable at a time (roving tabindex) so the
 * calendar is a single tab stop, not thirty-one.
 */
export function CalendarMonth({
  month,
  start,
  end,
  min,
  focused,
  onSelect,
  onFocus,
  hovered,
  onHover,
}: CalendarProps) {
  const labelId = useId();
  const weeks = monthGrid(month);

  const rangeEnd = end ?? (start && hovered && hovered > start ? hovered : undefined);

  return (
    <div className="min-w-0 flex-1">
      <p
        id={labelId}
        className="mb-3 text-center font-display text-sm font-bold tracking-tight"
      >
        {monthLabel(month)}
      </p>

      <table role="grid" aria-labelledby={labelId} className="w-full border-collapse">
        <thead>
          <tr>
            {WEEKDAYS.map((day, index) => (
              <th
                key={index}
                scope="col"
                abbr={
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                    index
                  ]
                }
                className="pb-2 tabular-nums text-[11px] font-normal text-ink-faint"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((date, dayIndex) => {
                if (!date) return <td key={dayIndex} className="p-0" />;

                const disabled = date < min;
                const isStart = date === start;
                const isEnd = date === end;
                const inRange =
                  !!start && !!rangeEnd && date > start && date < rangeEnd;

                return (
                  <td key={dayIndex} className="p-0">
                    <button
                      type="button"
                      tabIndex={date === focused ? 0 : -1}
                      disabled={disabled}
                      aria-label={formatFull(date)}
                      aria-selected={isStart || isEnd}
                      data-date={date}
                      onClick={() => onSelect(date)}
                      onFocus={() => onFocus(date)}
                      onMouseEnter={() => onHover?.(date)}
                      onMouseLeave={() => onHover?.(undefined)}
                      className={cn(
                        'relative flex h-10 w-full items-center justify-center tabular-nums text-sm transition-colors',
                        disabled && 'cursor-not-allowed text-hairline-strong',
                        !disabled && !isStart && !isEnd && 'text-ink hover:bg-accent-wash',
                        inRange && 'bg-accent-wash',
                        (isStart || isEnd) && 'bg-accent font-semibold text-white',
                        isStart && !!rangeEnd && 'rounded-l-full',
                        isEnd && 'rounded-r-full',
                        isStart && !rangeEnd && 'rounded-full',
                      )}
                    >
                      {dayOfMonth(date)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
