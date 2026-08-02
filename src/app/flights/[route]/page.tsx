import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SearchForm } from '@/features/flight-search/components/search-form';
import { carriersMissingFrom } from '@/features/flight-search/unavailable-carriers';
import { MissingCarriersNotice } from '@/features/flight-search/components/missing-carriers-notice';
import { getRouteInsight, getRoutesWithPages } from '@/features/routes/queries';
import { resolveRouteSlug } from '@/features/routes/slug';
import { formatDuration, formatMoney } from '@/lib/format';
import { countryName } from '@/features/booking/pre-travel';

/**
 * Route landing page.
 *
 * The whole risk with these is thin content. A page reading "Flights from
 * Newcastle to Malaga" above a search box is a doorway page — indistinguishable
 * from ten thousand generated ones, and demoted accordingly. The usual fix is
 * padding: invented weather summaries, a paragraph about the destination's
 * "vibrant culture", a fake "average price" nobody measured.
 *
 * We can't do that and keep the rest of the product honest. So every claim here
 * comes from a search someone actually ran — the airlines that came back, the
 * quickest itinerary seen, whether a direct exists — and a route we know little
 * about gets a page that says so plainly.
 *
 * That means fewer pages than a generated approach. It also means each one says
 * something true, which is the only kind worth having.
 */

/*
 * Cached for an hour and pre-rendered for the routes we know about.
 *
 * These pages were briefly force-dynamic. Not because they needed to be — the
 * root layout read the session, which put `cookies()` in every render and made
 * every route in the product dynamic whether it wanted to be or not. The header
 * now reads its own session in the browser, so this can go back to what it
 * should always have been.
 */
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const routes = await getRoutesWithPages();
  return routes.map((route) => ({ route: route.slug }));
}



export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string }>;
}): Promise<Metadata> {
  const { route: slug } = await params;
  const route = resolveRouteSlug(slug);
  if (!route) return { title: 'Route not found' };

  const insight = await getRouteInsight(route.originCode, route.destinationCode);
  const price =
    insight.cheapestAmount && insight.currency
      ? ` from ${formatMoney(insight.cheapestAmount, insight.currency)}`
      : '';

  return {
    title: `${route.originCity} to ${route.destinationCity} flights${price}`,
    description:
      `Compare flights from ${route.originCity} to ${route.destinationCity}. ` +
      `Every price includes taxes, airline charges and our fee, itemised before you pay.`,
    alternates: { canonical: `/flights/${slug}` },
  };
}

export default async function RoutePage({
  params,
}: {
  params: Promise<{ route: string }>;
}) {
  const { route: slug } = await params;
  const route = resolveRouteSlug(slug);
  if (!route) notFound();

  const insight = await getRouteInsight(route.originCode, route.destinationCode);
  const missing = carriersMissingFrom(route.originCode, route.destinationCode);

  /* Confidence gate. One search is an anecdote, not a fact about a route — so
     below the threshold the page shows the search form and says nothing else,
     rather than dressing a single observation as a pattern. */
  const hasSubstance = insight.observationCount >= 2;

  const faqs = buildFaqs(route, insight, missing.map((carrier) => carrier.name));

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-faint">
        <Link href="/" className="text-link underline underline-offset-2">
          Home
        </Link>
        <span className="mx-2" aria-hidden="true">
          ›
        </span>
        <span>
          {route.originCity} to {route.destinationCity}
        </span>
      </nav>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        Flights from {route.originCity} to {route.destinationCity}
      </h1>

      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
        {route.originCity}, {countryName(route.originCountry)} to{' '}
        {route.destinationCity}, {countryName(route.destinationCountry)}. Every
        price below includes taxes, airline charges and our fee — itemised, before
        you pay.
      </p>

      <div className="mt-8">
        <SearchForm
          initialOrigin={{ code: route.originCode, display: route.originCity }}
          initialDestination={{
            code: route.destinationCode,
            display: route.destinationCity,
          }}
        />
      </div>

      <div className="mt-8">
        <MissingCarriersNotice carriers={missing} />
      </div>

      {hasSubstance ? (
        <section aria-labelledby="what-we-know" className="mt-10">
          <h2
            id="what-we-know"
            className="font-display text-xl font-extrabold tracking-tight"
          >
            What we’ve seen on this route
          </h2>
          <p className="mt-2 mb-5 text-sm text-ink-muted">
            Drawn from {insight.observationCount} recent searches. Not a forecast —
            just what came back when people looked.
          </p>

          <dl className="grid gap-4 sm:grid-cols-3">
            {insight.cheapestAmount && insight.currency ? (
              <Stat
                term="Cheapest return seen"
                value={formatMoney(insight.cheapestAmount, insight.currency)}
              />
            ) : null}
            {insight.fastestMinutes ? (
              <Stat
                term="Quickest journey"
                value={formatDuration(insight.fastestMinutes)}
              />
            ) : null}
            {insight.directAvailable !== null ? (
              <Stat
                term="Direct flights"
                value={insight.directAvailable ? 'Available' : 'None seen'}
              />
            ) : null}
          </dl>

          {insight.airlines.length > 0 ? (
            <p className="mt-5 text-sm text-ink-muted">
              <span className="text-ink">Airlines we’ve seen:</span>{' '}
              {insight.airlines.join(', ')}.
              {missing.length > 0
                ? ` Not including ${missing.map((c) => c.name).join(' or ')}, who don’t make fares available to us.`
                : ''}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="mt-10 rounded-card border border-hairline bg-paper p-5 text-sm leading-relaxed text-ink-muted">
          We haven’t seen enough searches on this route to say anything useful about
          it yet. Search above and you’ll get live prices from the airlines — we’d
          rather show you nothing than pad this page with guesses.
        </p>
      )}

      <section aria-labelledby="route-faq" className="mt-12">
        <h2
          id="route-faq"
          className="mb-4 font-display text-xl font-extrabold tracking-tight"
        >
          {route.originCity} to {route.destinationCity}, answered
        </h2>
        <div className="grid gap-x-10 lg:grid-cols-2 lg:items-start">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group border-b border-hairline py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-baseline justify-between gap-4 text-sm font-medium text-ink">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Only the questions genuinely on the page. Marking up answers a visitor
          can't see is cloaking, and search engines treat it as such. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }),
        }}
      />
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <dt className="text-xs font-medium text-ink-faint">
        {term}
      </dt>
      <dd className="mt-1.5 tabular-nums text-lg font-semibold text-accent">{value}</dd>
    </div>
  );
}

/**
 * Questions answered from observed data, or not asked at all.
 *
 * A route FAQ is where generated pages invent most freely — "the best time to
 * book is 8 weeks ahead" on a route nobody measured. Each question here is only
 * included when we can answer it from something real.
 */
function buildFaqs(
  route: { originCity: string; destinationCity: string },
  insight: Awaited<ReturnType<typeof getRouteInsight>>,
  missingCarriers: string[],
): Array<{ q: string; a: string }> {
  const faqs: Array<{ q: string; a: string }> = [];

  if (insight.directAvailable !== null) {
    faqs.push({
      q: `Are there direct flights from ${route.originCity} to ${route.destinationCity}?`,
      a: insight.directAvailable
        ? `Yes — we've seen direct flights on this route in recent searches. Availability varies by date, so search your dates to see what's flying.`
        : `We haven't seen a direct flight on this route in recent searches, so it likely involves a connection. Search your dates to see the current options.`,
    });
  }

  if (insight.fastestMinutes) {
    faqs.push({
      q: `How long is the flight?`,
      a: `The quickest itinerary we've seen took ${formatDuration(insight.fastestMinutes)} in total. Connecting options take longer, and the difference is shown on every result.`,
    });
  }

  if (insight.airlines.length > 0) {
    faqs.push({
      q: `Which airlines fly this route?`,
      a: `We've seen ${insight.airlines.join(', ')} on recent searches. That's what's available through us rather than a complete list of who operates the route.`,
    });
  }

  if (missingCarriers.length > 0) {
    faqs.push({
      q: `Do you show ${missingCarriers.join(' and ')} fares?`,
      a: `No. ${missingCarriers.join(' and ')} don't make their fares available to us, so they won't appear in results here. They may be cheaper direct and it's worth checking before you book.`,
    });
  }

  faqs.push({
    q: `Is the price I see the price I pay?`,
    a: `Yes. Every figure includes the airline's fare, taxes and charges, and our fee — broken out on each result so you can see exactly what you're paying for. Nothing is added at a later screen.`,
  });

  faqs.push({
    q: `Is my booking ATOL protected?`,
    a: `No. Your ticket is issued by the airline the moment you pay, and flights sold that way fall outside the ATOL scheme, so no ATOL Certificate is issued. An airline's own ATOL licence covers bookings made directly with them and doesn't extend to bookings made here.`,
  });

  return faqs;
}
