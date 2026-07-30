import { cn } from '@/lib/cn';

interface RouteLineProps {
  /** Number of intermediate stops. Each one gets a marker on the line. */
  stops?: number;
  className?: string;
  /** Accessible description; without it the graphic is decorative. */
  label?: string;
}

/**
 * The product's signature device: a hairline path with a marker per stop and an
 * aircraft at the arrival end, drawn the way a chart draws an airway.
 *
 * Laid out with flex and borders rather than a stretched SVG. The previous
 * version used `viewBox="0 0 200 10"` with `preserveAspectRatio="none"`, which
 * squashed the arrowhead into an unreadable sliver at wide sizes — and had it
 * pointing backwards into the bargain. Geometry that has to survive arbitrary
 * container widths shouldn't be scaled geometry.
 *
 * Structural, not decorative: the markers encode stop count, the most important
 * non-price attribute of an itinerary.
 */
export function RouteLine({ stops = 0, className, label }: RouteLineProps) {
  // n stops means n+1 legs, so n+1 line segments with a marker between each.
  const legs = Math.min(stops, 3) + 1;

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('flex w-full items-center gap-1 text-chart', className)}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />

      {Array.from({ length: legs }, (_, index) => (
        <span key={index} className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className={cn(
              'min-w-0 flex-1 border-t',
              stops > 0 ? 'border-dashed' : 'border-solid',
            )}
          />
          {index < legs - 1 ? (
            <span className="size-1.5 shrink-0 rounded-full border border-current bg-surface" />
          ) : null}
        </span>
      ))}

      {/* Fixed-size arrowhead, pointing in the direction of travel. */}
      <svg
        viewBox="0 0 8 8"
        aria-hidden="true"
        className="size-2 shrink-0 overflow-visible"
      >
        <path
          d="M1 1 L6 4 L1 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
