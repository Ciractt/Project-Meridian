import Link from 'next/link';
import { runSearch } from '../results';
import { describeRetryAfter } from '../rate-limit';
import type { FlightSearchParams } from '../schema';
import { ResultsPanel } from './results-panel';
import { carriersMissingFrom } from '../unavailable-carriers';
import { MissingCarriersNotice } from './missing-carriers-notice';

/**
 * Async Server Component inside the page's <Suspense> boundary.
 *
 * Its only jobs are fetching, mapping the five result states onto something
 * honest to read, and handing the offers to <ResultsPanel /> for interaction.
 */
export async function ResultsList({ criteria }: { criteria: FlightSearchParams }) {
  const result = await runSearch(criteria);

  /* Rendered above every outcome, including the empty and error states. It
     matters most when we return nothing or only expensive fares, because that is
     exactly when a traveller concludes the route is dear rather than that our
     coverage is incomplete. */
  const missing = carriersMissingFrom(criteria.origin, criteria.destination);
  const notice = <MissingCarriersNotice carriers={missing} />;

  if (result.status === 'unconfigured') {
    return (
      <Notice title="Flight search isn’t connected yet.">
        Add <code className="font-mono">DUFFEL_API_TOKEN</code> to{' '}
        <code className="font-mono">.env.local</code> and restart the dev server.
      </Notice>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <Notice title="The airlines didn’t answer in time.">
        {result.message} Nothing was booked and nothing was charged. Searching again
        usually works.
      </Notice>
    );
  }

  if (result.status === 'throttled') {
    /* Says what happened rather than blaming the traveller or inventing a
       fault. Someone who has genuinely run forty distinct searches is doing
       something reasonable, and the honest thing is to explain the constraint
       and name the time — "try again later" with no number is the kind of
       non-answer this product exists not to give. */
    return (
      <Notice title="You’ve run a lot of searches in a short time.">
        Every search asks the airlines directly, and they cap how often we can do
        that. Repeating a search you’ve already run still works — those come from
        our own copy. Anything new will work again in{' '}
        {describeRetryAfter(result.retryAfterSeconds)}.
      </Notice>
    );
  }

  if (result.status === 'rejected') {
    return (
      <Notice title="We couldn’t run that search.">
        {result.message} Check the airports and dates, then try again.
      </Notice>
    );
  }

  if (result.status === 'empty') {
    return (
      <>
        {notice}
        <Notice title="No flights on this route for these dates.">
          Try nearby dates, a different airport, or allow connections.{' '}
          <Link href="/" className="text-airway underline underline-offset-2">
            Change search
          </Link>
        </Notice>
      </>
    );
  }

  const travellers = criteria.adults + criteria.childAges.length;

  // One logo per airline for the filter rail, resolved here so the client
  // component doesn't have to walk every offer to find them.
  const logos: Record<string, string | null> = {};
  for (const offer of result.offers) {
    if (offer.airlineCode && !(offer.airlineCode in logos)) {
      logos[offer.airlineCode] = offer.airlineLogoUrl;
    }
  }

  return (
    <>
      {notice}
      <ResultsPanel
        offers={result.offers}
        travellers={travellers}
        logos={logos}
        cached={result.cached}
      />
    </>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-8 text-center">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        {children}
      </p>
    </div>
  );
}
