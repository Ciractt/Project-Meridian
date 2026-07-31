import { Suspense } from 'react';
import Link from 'next/link';
import { flightSearchSchema, toSearchParams } from '@/features/flight-search/schema';
import { ResultsList } from '@/features/flight-search/components/results-list';
import { addDays, formatShort, todayKey } from '@/lib/date';

/**
 * Server Component. Criteria live entirely in the URL (ADR-001), so this page
 * is shareable, bookmarkable and back-button-correct.
 *
 * The sticky summary bar renders immediately from validated params;
 * <ResultsList /> suspends while Duffel talks to the airlines.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = flightSearchSchema.safeParse(raw);

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24">
        <p className="text-sm font-medium text-chart">
          Search
        </p>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
          This search link isn’t complete.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Some details are missing or out of date — a past departure date, most
          likely. Start again and we’ll take it from there.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-control bg-chart px-5 py-3 text-sm font-medium text-white"
        >
          New search
        </Link>
      </div>
    );
  }

  const criteria = parsed.data;
  const travellers = criteria.adults + criteria.childAges.length;

  /**
   * Shifting a date by a day is the most common thing a traveller does on a
   * results page, so it's a link rather than a trip back to the search form.
   * Returns null when the shift would be invalid, and the control renders
   * disabled rather than vanishing.
   */
  function shift(field: 'departureDate' | 'returnDate', days: number): string | null {
    const next = addDays(criteria[field] ?? criteria.departureDate, days);
    if (next < todayKey()) return null;

    const updated = { ...criteria, [field]: next };
    if (updated.returnDate && updated.returnDate < updated.departureDate) {
      if (field === 'departureDate') updated.returnDate = next;
      else return null;
    }
    return `/search?${toSearchParams(updated).toString()}`;
  }

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-night-line bg-night">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <p className="flex items-baseline gap-2 text-sm text-white">
            <span className="font-mono text-base font-semibold">{criteria.origin}</span>
            <span aria-hidden="true" className="text-chart">
              →
            </span>
            <span className="font-mono text-base font-semibold">
              {criteria.destination}
            </span>
            <span className="ml-2 text-white/60">
              {travellers} {travellers === 1 ? 'traveller' : 'travellers'}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <DayStepper
              label="Departure date"
              value={formatShort(criteria.departureDate)}
              previous={shift('departureDate', -1)}
              next={shift('departureDate', 1)}
            />
            {criteria.returnDate ? (
              <DayStepper
                label="Return date"
                value={formatShort(criteria.returnDate)}
                previous={shift('returnDate', -1)}
                next={shift('returnDate', 1)}
              />
            ) : null}
          </div>

          <Link
            href="/"
            className="ml-auto rounded-control border border-white/25 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:border-white/60"
          >
            Edit search
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <Suspense key={JSON.stringify(criteria)} fallback={<ResultsSkeleton />}>
          <ResultsList criteria={criteria} />
        </Suspense>
      </div>
    </>
  );
}

function DayStepper({
  label,
  value,
  previous,
  next,
}: {
  label: string;
  value: string;
  previous: string | null;
  next: string | null;
}) {
  return (
    <div className="flex items-center gap-1 rounded-control bg-white/10 p-0.5">
      <StepLink href={previous} label={`${label}, one day earlier`} glyph="‹" />
      <span className="min-w-24 text-center font-mono text-xs text-white">{value}</span>
      <StepLink href={next} label={`${label}, one day later`} glyph="›" />
    </div>
  );
}

function StepLink({
  href,
  label,
  glyph,
}: {
  href: string | null;
  label: string;
  glyph: string;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="flex size-7 items-center justify-center rounded text-white/25"
      >
        <span aria-hidden="true">{glyph}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      scroll={false}
      className="flex size-7 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/15 hover:text-white"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <div className="hidden h-72 animate-pulse rounded-card bg-hairline/60 lg:block" />
      <div>
        <p className="mb-4 text-sm text-ink-faint" role="status">
          Checking fares with the airlines. This can take up to twenty seconds.
        </p>
        <ul className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <li
              key={index}
              className="h-32 animate-pulse rounded-card border border-hairline bg-surface"
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
