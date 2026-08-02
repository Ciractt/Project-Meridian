'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { toMinorUnits } from '../money';
import { useCheckoutTotals } from '../checkout-totals';
import { Button } from '@/components/ui/button';
import type { SelectedService } from '../services';
import type { PassengerDraft } from './passenger-fields';

/**
 * Duffel's bags-and-seats component.
 *
 * Loaded client-side only: it renders seat maps and its own interactive UI, and
 * the payload is large enough that everyone who never reaches checkout shouldn't
 * pay for it.
 *
 * Using a vendor component means accepting vendor types at this one boundary —
 * the raw Duffel offer and seat maps are passed straight through rather than
 * going via our domain types (a documented exception to ADR-002). The trade-off
 * is deliberate: hand-building a seat map is a great deal of fiddly work for a
 * screen a traveller sees once.
 *
 * `markup` is set to our extras margin so the price shown next to a bag is the
 * price it adds to the total. `calculateCharge` applies the same rate server-side
 * — the two must stay in step, which is why the rate comes from one place.
 */
const DuffelAncillaries = dynamic(
  () => import('@duffel/components').then((module) => module.DuffelAncillaries),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-card border border-hairline bg-paper" />
    ),
  },
);

export function AncillariesStep({
  offer,
  seatMaps,
  passengers,
  markupRate,
  onConfirm,
  onSkip,
  busy,
}: {
  /** Raw Duffel offer. Vendor type by necessity. */
  offer: unknown;
  seatMaps: unknown;
  passengers: PassengerDraft[];
  markupRate: number;
  onConfirm: (services: SelectedService[]) => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<SelectedService[]>([]);
  const [chosenCount, setChosenCount] = useState(0);
  const { setExtras } = useCheckoutTotals();

  return (
    <section className="space-y-4">
      <div className="rounded-card border border-hairline bg-surface p-5">
        <h2 className="font-display text-base font-bold tracking-tight">
          Bags and seats
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Optional. Prices shown are what they add to your total — nothing is added
          afterwards.
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DuffelAncillaries
        {...({
          offer,
          seat_maps: seatMaps,
          passengers: passengers.map((passenger) => ({
            id: passenger.id,
            given_name: passenger.givenName,
            family_name: passenger.familyName,
            born_on: passenger.bornOn,
            gender: passenger.gender,
            title: passenger.title,
          })),
          services: ['bags', 'seats'],
          markup: {
            bags: { rate: markupRate, amount: 0 },
            seats: { rate: markupRate, amount: 0 },
          },
          /* Duffel's component takes literal values, not CSS variables, so
             these are the one place the palette is duplicated. They have to be
             changed by hand whenever --color-accent or --radius-control move, or
             the seat map is the last magenta thing on a blue site. */
          styles: {
            accentColor: 'rgb(51, 80, 224)',
            buttonCornerRadius: '12px',
          },
          onPayloadReady: (
            data: { services?: SelectedService[] },
            metadata: AncillariesMetadata | undefined,
          ) => {
            const services = data.services ?? [];
            setSelected(services);
            setChosenCount(services.length);

            /* Only what gets sent to the server is `services` — id and
               quantity, no prices, exactly as before. The metadata is read for
               display alone: Duffel has already applied our markup to these
               figures, so the preview and the charge should agree, and
               startBooking re-prices regardless. */
            setExtras(...sumExtras(metadata));
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-sm text-link underline underline-offset-2 hover:no-underline"
        >
          Continue without extras
        </button>
        <Button
          type="button"
          variant="accent"
          size="lg"
          loading={busy}
          onClick={() => onConfirm(selected)}
        >
          {chosenCount > 0
            ? `Continue with ${chosenCount} extra${chosenCount === 1 ? '' : 's'}`
            : 'Continue to payment'}
        </Button>
      </div>

      <p className="text-xs text-ink-faint">
        We re-check every extra’s price with the airline before your card is
        charged.
      </p>
    </section>
  );
}

/**
 * The shape of Duffel's second `onPayloadReady` argument, narrowed to the
 * three fields we read. Their own type is exported but the component is
 * already cast to `any` at the call site for the reasons above it, so this
 * describes only what is actually touched.
 */
interface AncillariesMetadata {
  baggage_services?: Array<{
    serviceInformation?: { total_amount?: string; total_currency?: string };
  }>;
  seat_services?: Array<{
    serviceInformation?: { total_amount?: string; total_currency?: string };
  }>;
}

/**
 * Adds up what has been selected, in minor units.
 *
 * Returns `[null, null]` if any line is unparseable or the currencies differ,
 * rather than a partial sum. A total that quietly drops a service is worse
 * than a panel that carries on showing the flight price — the first is wrong,
 * the second is merely incomplete, and the payment step corrects both.
 */
function sumExtras(
  metadata: AncillariesMetadata | undefined,
): [number | null, string | null] {
  const lines = [
    ...(metadata?.baggage_services ?? []),
    ...(metadata?.seat_services ?? []),
  ];
  if (lines.length === 0) return [0, null];

  let total = 0;
  let currency: string | null = null;

  for (const line of lines) {
    const amount = line.serviceInformation?.total_amount;
    const lineCurrency = line.serviceInformation?.total_currency;
    if (!amount || !lineCurrency) return [null, null];
    if (currency && currency !== lineCurrency) return [null, null];

    const minor = toMinorUnits(amount);
    if (minor === null) return [null, null];

    currency = lineCurrency;
    total += minor;
  }

  return [total, currency];
}
