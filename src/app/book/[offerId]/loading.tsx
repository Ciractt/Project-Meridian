import { RouteLine } from '@/components/route-line';

/**
 * The availability check, made visible.
 *
 * We already re-read the live offer from the airline before this page renders —
 * that is what `repriceOffer` does, and it is the step that stops someone
 * entering their details against a fare that has moved or gone.
 *
 * Until now it happened behind a blank screen. Saying what is happening is worth
 * doing for two reasons: a wait with a reason attached feels shorter than the
 * same wait without one, and it is the moment the product's whole claim about
 * prices is actually being honoured. Announcing it is honest, not decorative.
 */
export default function ConfirmingAvailability() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
      <p className="font-mono text-[11px] tracking-[0.18em] text-chart uppercase">
        Almost there
      </p>

      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
        Confirming this fare with the airline
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        We’re checking the seats are still there and the price hasn’t moved. It
        takes a few seconds, and nothing is charged at this stage.
      </p>

      <div className="mt-8 w-full max-w-xs" aria-hidden="true">
        <RouteLine />
      </div>

      {/* A determinate-looking bar would be a lie — we don't know how long the
          airline will take. An indeterminate one says "working" without
          pretending to know. */}
      <div
        role="status"
        aria-live="polite"
        className="mt-8 h-1 w-full max-w-xs overflow-hidden rounded-full bg-hairline"
      >
        <div className="h-full w-1/3 animate-pulse rounded-full bg-chart" />
        <span className="sr-only">Confirming availability with the airline</span>
      </div>
    </div>
  );
}
