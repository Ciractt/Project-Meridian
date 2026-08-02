import { ChevronRight } from 'lucide-react';

/**
 * The line between two points of a journey.
 *
 * This replaces the chart-era route line, which was removed in ADR-043 on the
 * grounds that it duplicated the "Direct" / "1 stop" text beside it. That
 * reasoning was sound about the *information* and wrong about the *drawing*: a
 * bare hairline in its place read as a divider that had lost its content, and
 * the eye followed it expecting something at the end.
 *
 * So the direction comes back and the redundancy does not. There is a mark
 * where the journey starts and a chevron where it ends, which is enough to say
 * "from here to there" — and stop markers, because a glance at the line then
 * tells you the shape of the trip without reading anything. That last part is
 * the only reason a graphic beats an en dash here.
 *
 * Decorative throughout. Every place this appears already states the route and
 * the stop count in text, so the whole thing is `aria-hidden` and a screen
 * reader gets the words rather than a description of a picture.
 */
export function RouteArrow({
  stops = 0,
  className = '',
}: {
  /** Intermediate stops. Rendered as hollow marks along the line. */
  stops?: number;
  className?: string;
}) {
  /* More than three marks stops reading as a journey and starts reading as a
     dotted border. Nobody is booking a five-stop itinerary off the shape of a
     line anyway, and the text beside it is exact. */
  const marks = Math.min(stops, 3);

  return (
    <span
      aria-hidden="true"
      className={`flex min-w-0 items-center gap-1 text-accent ${className}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="flex min-w-0 flex-1 items-center gap-1">
        {Array.from({ length: marks + 1 }).map((_, index) => (
          <span key={index} className="contents">
            <span className="h-px min-w-2 flex-1 bg-current opacity-40" />
            {index < marks ? (
              <span className="size-1.5 shrink-0 rounded-full border border-current bg-surface" />
            ) : null}
          </span>
        ))}
      </span>
      <ChevronRight className="size-3 shrink-0" strokeWidth={2.5} />
    </span>
  );
}
