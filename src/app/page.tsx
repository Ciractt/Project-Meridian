import { SearchForm } from '@/features/flight-search/components/search-form';
import { FEATURED_ROUTES } from '@/features/destinations/routes';
import { RouteCard } from '@/features/destinations/components/route-card';
import { getRoutePrices } from '@/features/destinations/prices';
import { getDemandRoutes } from '@/features/destinations/demand';
import { getLivePromotions } from '@/features/promotions/queries';
import { PromoCarousel } from '@/features/promotions/components/promo-carousel';
import { TrustStrip } from '@/components/trust-strip';
import { HomeFaq } from '@/components/home-faq';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { routeSlug } from '@/features/routes/slug';
import { getSiteContent } from '@/features/content/queries';
import { parseRecent, RECENT_COOKIE } from '@/features/flight-search/recent';
import { RecentSearches } from '@/features/flight-search/components/recent-searches';
import { HeroCollage } from '@/features/destinations/components/hero-collage';

/**
 * Server Component. The only client boundary is <SearchForm />.
 *
 * The page alternates between the night panel, paper and white so it has some
 * rhythm — an earlier version put everything on one pale background at one scale,
 * which read as a wireframe however good the individual pieces were.
 *
 * The search bar stays the hero. Everything below it either carries a number or
 * answers a question; nothing is here to fill space.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined): string =>
    typeof value === 'string' ? value : '';

  const initialOrigin = one(params.origin)
    ? {
        code: one(params.origin).toUpperCase(),
        display: one(params.originCity) || one(params.origin).toUpperCase(),
      }
    : undefined;
  const initialDestination = one(params.destination)
    ? {
        code: one(params.destination).toUpperCase(),
        display: one(params.destinationCity) || one(params.destination).toUpperCase(),
      }
    : undefined;

  const cookieStore = await cookies();
  const recent = parseRecent(cookieStore.get(RECENT_COOKIE)?.value);

  const [promotions, routePrices, demandRoutes, content] = await Promise.all([
    getLivePromotions(),
    getRoutePrices(),
    getDemandRoutes(6),
    getSiteContent(),
  ]);

  /* Follow real demand once there's enough of it; fall back to the curated set
     below that threshold. Three is the point where a "popular routes" grid stops
     looking like a list of whatever two people searched this morning. */
  const useDemand = demandRoutes.length >= 3;
  const routes = useDemand
    ? demandRoutes
    : FEATURED_ROUTES.map((route) => ({
        ...route,
        price: routePrices.get(`${route.from}-${route.to}`),
      }));

  const anyPrices = routes.some((route: (typeof routes)[number]) => route.price);

  return (
    <>
      {/* Light hero, not a dark band.
          The dark version was doing a photograph's job without being one — a
          large flat area carrying contrast that imagery should carry. Light lets
          the search bar be the darkest, most deliberate thing on the page, which
          is the right hierarchy for a page whose only job is to get someone
          searching. */}
      {/* NO overflow-hidden. The comboboxes and the calendar are absolutely
          positioned children that must escape this section — clipping here is
          how the date picker silently stopped opening once before. The grid is
          inset-0 and the collage clips itself, so nothing needs containing. */}
      <section className="relative bg-paper">
                <div className="relative mx-auto max-w-6xl px-5 pt-12 pb-12 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
            <div className="min-w-0">
              {content.hero.eyebrow ? (
                <p className="text-sm font-medium text-accent">
                  {content.hero.eyebrow}
                </p>
              ) : null}
              <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
                {content.hero.headline}
              </h1>
              {content.hero.subhead ? (
                <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
                  {content.hero.subhead}
                </p>
              ) : null}

              <div id="search" className="mt-8 scroll-mt-8">
                <SearchForm
                  initialOrigin={initialOrigin}
                  initialDestination={initialDestination}
                />
              </div>

              <RecentSearches searches={recent} />
            </div>

            {/* Decorative, and last in the source order so a screen reader and a
                narrow viewport both reach the search bar first. */}
            <HeroCollage />
          </div>

          <div className="mt-12">
            <TrustStrip />
          </div>
        </div>
      </section>

      {promotions.length > 0 ? (
        /* Straddles the paper/white seam rather than stopping on it.
           The banner previously ended exactly where the background changed,
           which reads as a misalignment rather than a decision. Two absolute
           halves give it a colour change through its middle — no negative
           margins, no z-index, and it collapses cleanly when there's no
           promotion to show. */
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/2 bg-paper"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-surface"
          />

          {/* Below the search bar, never above it. */}
          <div className="relative mx-auto max-w-6xl px-5 py-12">
            <PromoCarousel promotions={promotions} />
          </div>
        </div>
      ) : null}

      <section aria-labelledby="routes" className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="routes"
                className="font-display text-2xl font-extrabold tracking-tight"
              >
                {useDemand ? 'What people are searching' : 'Popular from the UK'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-ink-muted">
                {anyPrices
                  ? 'Cheapest returns we’ve seen recently, taxes and airline charges included. Pick a route and we’ll check live availability for your dates.'
                  : 'Pick a route and we’ll ask for your dates. Every price includes taxes and airline charges.'}
              </p>
            </div>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route: (typeof routes)[number]) => (
              <li key={`${route.from}-${route.to}`}>
                <RouteCard route={route} price={route.price} />
              </li>
            ))}
          </ul>

          {/* Internal links to the route pages. Without these they are orphans —
              in the sitemap but reachable only from search, which is the slowest
              possible way for them to be found. */}
          {useDemand ? (
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
              <span>Route guides:</span>
              {routes.slice(0, 6).map((route: (typeof routes)[number]) => {
                const slug = routeSlug(route.from, route.to);
                return slug ? (
                  <Link
                    key={slug}
                    href={`/flights/${slug}`}
                    className="text-link underline underline-offset-2"
                  >
                    {route.fromCity} to {route.toCity}
                  </Link>
                ) : null;
              })}
            </p>
          ) : null}

          {anyPrices ? (
            <p className="mt-5 text-xs text-ink-faint">
              Indicative only. Fares move constantly and these were true for one set
              of dates when we last saw them — we re-check the live price before
              anything is charged.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="how" className="bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2
            id="how"
            className="font-display text-2xl font-extrabold tracking-tight"
          >
            Why book here
          </h2>

          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                term: 'One search',
                headline: 'Full-service and low-cost, side by side',
                detail:
                  'Ranked by what the journey actually costs you, with the baggage each fare includes shown on the result. A cheap fare with no checked bag often isn’t the cheaper one.',
                mark: 'text-link',
                rule: 'bg-link',
              },
              {
                term: 'Whole price',
                headline: 'Nothing appears at the last screen',
                detail:
                  'Taxes, airline charges and card fees are inside every figure from the first result onwards. Bags and seats are priced before you pay, at the amount they add to your total.',
                mark: 'text-accent',
                rule: 'bg-accent',
              },
              {
                term: 'Real tickets',
                headline: 'Issued the moment you pay',
                detail:
                  'Your airline reference works on the airline’s own site for seats, bags and check-in. We re-check the live fare before charging, so the price never moves underneath you.',
                mark: 'text-positive',
                rule: 'bg-positive',
              },
            ].map((item) => (
              <div key={item.term}>
                <div className={`h-0.5 w-10 ${item.rule}`} aria-hidden="true" />
                <dt
                  className={`mt-4 text-xs font-medium ${item.mark}`}
                >
                  {item.term}
                </dt>
                <dd>
                  <p className="mt-2 font-display text-base font-bold tracking-tight">
                    {item.headline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {item.detail}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="bg-surface">
        <div className="mx-auto max-w-6xl px-5">
          <HomeFaq />
        </div>
      </div>
    </>
  );
}
