import Link from 'next/link';
import { RouteLine } from '@/components/route-line';
import { formatShort } from '@/lib/date';
import type { RecentSearch } from '../recent';

/**
 * Pick up where you left off.
 *
 * Sits directly under the search bar because that is where it is useful — most
 * people search the same route two or three times before booking, and this turns
 * the second attempt into one click.
 *
 * No prices. These are searches, not offers, and a remembered fare would be stale
 * the moment it was written.
 */
export function RecentSearches({ searches }: { searches: RecentSearch[] }) {
  if (searches.length === 0) return null;

  return (
    <section aria-labelledby="recent" className="mt-8">
      <h2
        id="recent"
        className="mb-3 text-xs font-medium text-ink-faint"
      >
        Pick up where you left off
      </h2>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {searches.map((search) => (
          <li key={search.href}>
            <Link
              href={search.href}
              className="block rounded-card border border-hairline bg-surface px-4 py-3 transition-colors hover:border-hairline-strong"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink">
                  {search.origin}
                </span>
                <span className="min-w-0 flex-1">
                  <RouteLine className="text-chart" />
                </span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {search.destination}
                </span>
              </span>

              <span className="mt-2 block truncate text-xs text-ink-muted">
                {search.departureDate ? formatShort(search.departureDate) : 'Any date'}
                {search.returnDate ? ` – ${formatShort(search.returnDate)}` : ''}
                {' · '}
                {search.travellers}{' '}
                {search.travellers === 1 ? 'traveller' : 'travellers'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
