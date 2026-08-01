import Image from 'next/image';
import { RouteArrow } from '@/components/route-arrow';
import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { routeSearchHref, type FeaturedRoute } from '../routes';
import { destinationImage } from '../images';
import type { RoutePrice } from '../prices';

/**
 * Destination card.
 *
 * Two genuinely different layouts rather than one layout with a hole in it.
 *
 * With artwork it is a 4:3 image card — the shape every travel site uses, because a
 * photograph is the hook. Without, it is a compact row: codes, city, country. An
 * aspect ratio that exists to hold a picture should not survive the picture's
 * absence, so these are two layouts rather than one with a hole in it.
 *
 * Which it renders is decided by whether artwork exists for the destination code,
 * looked up automatically. Nothing here is configured per route.
 */
export function RouteCard({
  route,
  price,
}: {
  route: FeaturedRoute;
  /** Cheapest fare recently seen. Absent until someone searches this route. */
  price?: RoutePrice;
}) {
  const shell =
    'group block overflow-hidden rounded-card border border-hairline bg-surface transition-colors hover:border-hairline-strong';

  /* Resolved from the destination code, not configured on the route. The set of
     routes shown is demand-driven, so image lookup has to be automatic. */
  const image = destinationImage(route.to);

  if (!image) {
    return (
      <Link href={routeSearchHref(route)} className={`${shell} px-5 py-4`}>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold tracking-tight">
              {route.toCity}
              <span className="ml-2 font-sans text-sm font-normal text-ink-muted">
                {route.country}
              </span>
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span className="tabular-nums text-xs font-semibold tracking-[0.08em]">
                {route.from}
              </span>
              <RouteArrow className="flex-1" />
              <span className="tabular-nums text-xs font-semibold tracking-[0.08em]">
                {route.to}
              </span>
            </div>

            <p className="mt-2 text-xs text-ink-faint">from {route.fromCity}</p>
          </div>

          {price ? (
            <PriceTag price={price} />
          ) : (
            <span
              aria-hidden="true"
              className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
            >
              ›
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={routeSearchHref(route)} className={shell}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={image}
          alt={`${route.toCity}, ${route.country}`}
          fill
          // Three across on desktop, two on tablet, one on mobile. Without this
          // the browser downloads a full-width image for a third-width slot.
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-tight">
              {route.toCity}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">{route.country}</p>
          </div>
          {price ? <PriceTag price={price} /> : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="tabular-nums text-xs font-semibold tracking-[0.08em]">
            {route.from}
          </span>
          <RouteArrow className="flex-1" />
          <span className="tabular-nums text-xs font-semibold tracking-[0.08em]">
            {route.to}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * The indicative fare.
 *
 * "from" and the age caveat are not decoration. This figure was true for one set
 * of dates at one moment and will often not be available now — presenting it as
 * *the* price would be the drip-pricing failure inverted, which is a poor look on
 * a site whose headline is about prices not moving.
 */
function PriceTag({ price }: { price: RoutePrice }) {
  return (
    <span className="shrink-0 text-right">
      <span className="block tabular-nums text-lg leading-none font-semibold text-chart">
        {formatMoney(price.amount, price.currency)}
      </span>
      <span className="mt-1 block text-[10px] text-ink-faint">
        from · {describeAge(price.observedAt)}
      </span>
    </span>
  );
}

function describeAge(observedAt: string): string {
  const hours = (Date.now() - Date.parse(observedAt)) / 3_600_000;
  if (!Number.isFinite(hours)) return 'seen recently';
  if (hours < 2) return 'seen just now';
  if (hours < 24) return `seen ${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `seen ${days} day${days === 1 ? '' : 's'} ago`;
}
