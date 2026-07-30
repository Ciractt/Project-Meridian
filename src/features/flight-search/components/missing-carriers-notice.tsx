import type { UnavailableCarrier } from '../unavailable-carriers';

/**
 * Names the airlines we can't show on this route.
 *
 * Sits with the results rather than the summary, because that is where someone is
 * forming a view about whether they've seen the whole market. Phrased as a fact
 * about our coverage rather than an apology, and it says the useful thing —
 * "check direct" — instead of hoping nobody does.
 */
export function MissingCarriersNotice({
  carriers,
}: {
  carriers: UnavailableCarrier[];
}) {
  if (carriers.length === 0) return null;

  const names =
    carriers.length === 1
      ? carriers[0]!.name
      : `${carriers.slice(0, -1).map((carrier) => carrier.name).join(', ')} or ${carriers[carriers.length - 1]!.name}`;

  return (
    <p className="mb-4 rounded-card border border-caution/30 bg-caution-wash px-4 py-3 text-sm leading-relaxed text-caution">
      We can’t currently show {names} fares on this route. They may be cheaper
      direct, and it’s worth a look before you book.
    </p>
  );
}
