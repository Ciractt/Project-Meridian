'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { flightSearchSchema, toSearchParams } from '../schema';
import { rememberSearch } from '../recent';
import type { PassengerSelection, TripType } from '../types';
import { PlaceField } from './place-field';
import { PassengersField } from './passengers-field';
import { DateRangeField } from './date-range-field';

type FieldErrors = Partial<Record<string, string>>;

interface PlaceValue {
  code: string;
  display: string;
}

/**
 * The search bar.
 *
 * Structure follows the pattern every major OTA converged on — one connected
 * row of segments ending in the action — because it is genuinely the right
 * shape for the task: the whole query is visible at once, each segment is a
 * large target, and the primary action never moves. Our identity lives in the
 * type, the colour and the calendar, not in rearranging controls travellers
 * already know how to use.
 *
 * On submit it validates and navigates to /search?… (ADR-001). It does not
 * fetch.
 */
export function SearchForm({
  initialOrigin,
  initialDestination,
}: {
  /** Pre-filled from a route shortcut on the home page. */
  initialOrigin?: PlaceValue;
  initialDestination?: PlaceValue;
} = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tripType, setTripType] = useState<TripType>('return');
  const [origin, setOrigin] = useState<PlaceValue>(
    initialOrigin ?? { code: '', display: '' },
  );
  const [destination, setDestination] = useState<PlaceValue>(
    initialDestination ?? { code: '', display: '' },
  );
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState<PassengerSelection>({
    adults: 1,
    childAges: [],
  });
  const [cabin, setCabin] = useState('economy');
  const [direct, setDirect] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function swapPlaces() {
    setOrigin(destination);
    setDestination(origin);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = flightSearchSchema.safeParse({
      tripType,
      origin: origin.code,
      destination: destination.code,
      departureDate,
      returnDate: tripType === 'return' ? returnDate : undefined,
      adults: passengers.adults,
      childAges: passengers.childAges.join(','),
      cabin,
      direct: direct ? 'true' : 'false',
    });

    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    const query = toSearchParams(result.data);
    const href = `/search?${query.toString()}`;

    // Written before navigating, so it survives even if the results page errors.
    rememberSearch({
      origin: result.data.origin,
      destination: result.data.destination,
      originCity: origin.display || result.data.origin,
      destinationCity: destination.display || result.data.destination,
      departureDate: result.data.departureDate,
      returnDate: result.data.returnDate ?? '',
      travellers: result.data.adults + result.data.childAges.length,
      href,
    });

    startTransition(() => router.push(href));
  }

  const dateError = errors.departureDate ?? errors.returnDate;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Flight search">
      <fieldset className="mb-3">
        <legend className="sr-only">Trip type</legend>
        <div className="inline-flex rounded-full border border-hairline bg-surface p-0.5">
          {(['return', 'one-way'] as const).map((type) => (
            <label
              key={type}
              className={cn(
                'cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium tracking-tight transition-colors',
                tripType === type
                  ? 'bg-ink text-white'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <input
                type="radio"
                name="tripType"
                value={type}
                checked={tripType === type}
                onChange={() => {
                  setTripType(type);
                  if (type === 'one-way') setReturnDate('');
                }}
                className="sr-only"
              />
              {type === 'return' ? 'Return' : 'One way'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* One connected row on desktop, stacked rows on mobile. No
          overflow-hidden — the comboboxes and calendar have to escape it. */}
      {/* A border as well as a shadow now: on a light background the card needs
          an edge to read as a distinct surface rather than a lighter patch. */}
      <div className="grid rounded-card border border-hairline bg-surface shadow-xl shadow-ink/10 lg:grid-cols-[1.1fr_3rem_1.1fr_1.3fr_1.1fr_auto]">
        <Segment className="rounded-t-card lg:rounded-l-card lg:rounded-tr-none">
          <PlaceField
            label="Where from?"
            name="origin"
            value={origin.code}
            display={origin.display}
            onChange={setOrigin}
            error={errors.origin}
            placeholder="City or airport"
          />
        </Segment>

        <div className="relative hidden w-12 shrink-0 lg:block">
          <button
            type="button"
            onClick={swapPlaces}
            aria-label="Swap departure and destination"
            className="absolute top-1/2 left-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:border-ink hover:text-ink"
          >
            <span aria-hidden="true" className="text-sm">
              ⇄
            </span>
          </button>
        </div>

        <Segment>
          <PlaceField
            label="Where to?"
            name="destination"
            value={destination.code}
            display={destination.display}
            onChange={setDestination}
            error={errors.destination}
            placeholder="City or airport"
          />
        </Segment>

        <Segment>
          <DateRangeField
            tripType={tripType}
            departureDate={departureDate}
            returnDate={returnDate}
            onChange={(next) => {
              setDepartureDate(next.departureDate);
              setReturnDate(next.returnDate);
            }}
            error={dateError}
          />
        </Segment>

        <Segment className="border-b-0 lg:border-r">
          <PassengersField
            value={passengers}
            onChange={setPassengers}
            cabin={cabin}
            onCabinChange={setCabin}
            error={errors.adults ?? errors.childAges}
          />
        </Segment>

        <div className="p-2 lg:p-2">
          <Button
            type="submit"
            variant="accent"
            loading={isPending}
            className="h-full w-full lg:px-8"
          >
            {isPending ? 'Searching' : 'Search'}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <input
            type="checkbox"
            checked={direct}
            onChange={(event) => setDirect(event.target.checked)}
            className="size-4 accent-[var(--color-chart)]"
          />
          Direct flights only
        </label>
        <p className="text-xs text-ink-faint">No card details needed to search.</p>
      </div>
    </form>
  );
}

function Segment({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-hairline lg:border-b-0 lg:border-r', className)}>
      {children}
    </div>
  );
}
