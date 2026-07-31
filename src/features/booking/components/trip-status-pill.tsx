/**
 * State of a trip, at a glance.
 *
 * Cancellations were only visible by opening the booking, which meant an account
 * page could show a cancelled flight looking exactly like a live one. That is the
 * kind of quiet wrongness that gets someone to an airport.
 *
 * Check-in windows are airline-specific — commonly 24 to 48 hours, sometimes 30
 * days — so this says a flight is *close*, not that check-in is open. Telling
 * someone to check in when the airline won't let them yet is worse than saying
 * nothing.
 */
export function TripStatusPill({
  cancelled,
  daysUntilDeparture,
}: {
  cancelled: boolean;
  daysUntilDeparture: number | null;
}) {
  if (cancelled) {
    return (
      <Pill className="border-danger/30 bg-chart-wash text-danger">Cancelled</Pill>
    );
  }

  if (daysUntilDeparture === null) {
    return <Pill className="border-hairline bg-paper text-ink-faint">Travelled</Pill>;
  }

  if (daysUntilDeparture === 0) {
    return (
      <Pill className="border-chart/30 bg-chart-wash text-chart">Today</Pill>
    );
  }

  if (daysUntilDeparture === 1) {
    return (
      <Pill className="border-chart/30 bg-chart-wash text-chart">Tomorrow</Pill>
    );
  }

  if (daysUntilDeparture <= 3) {
    return (
      <Pill className="border-caution/30 bg-caution-wash text-caution">
        In {daysUntilDeparture} days · check in with the airline
      </Pill>
    );
  }

  return (
    <Pill className="border-hairline bg-paper text-ink-muted">
      In {daysUntilDeparture} days
    </Pill>
  );
}

function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
