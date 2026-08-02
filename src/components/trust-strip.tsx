/**
 * Claims row beneath the search bar.
 *
 * Every incumbent has one of these — lastminute's says "No fuel surcharges | ATOL
 * protection | Travel expert support". Ours can't say ATOL, so it says things that
 * are true instead. Each line is a promise the code actually keeps:
 *
 *  - whole price      — calculateCharge grosses up card fees, so the figure shown
 *                       is the figure charged
 *  - instant ticket   — Duffel instant-tickets; the PNR works on the airline's site
 *  - no account       — checkout takes guest bookings
 *
 * A trust strip you can't back up is worse than no trust strip, because the first
 * person who tests it stops believing the rest of the page.
 */
const CLAIMS = [
  {
    title: 'The whole price, itemised',
    detail:
      'Airline fare, taxes, and our fee — broken out on every result, adding up to the figure you pay.',
  },
  {
    title: 'Ticketed straight away',
    detail: 'Your airline reference arrives with your confirmation, not days later.',
  },
  {
    title: 'No account needed',
    detail: 'Search and book as a guest. Sign in only if you want your trips saved.',
  },
] as const;

export function TrustStrip() {
  return (
    <ul className="grid gap-x-8 gap-y-4 border-t border-hairline pt-6 sm:grid-cols-3">
      {CLAIMS.map((claim) => (
        <li key={claim.title}>
          <p className="flex items-baseline gap-2 text-sm font-medium text-ink">
            <span aria-hidden="true" className="text-accent">
              ✓
            </span>
            {claim.title}
          </p>
          <p className="mt-1 pl-5 text-xs leading-relaxed text-ink-muted">
            {claim.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}
