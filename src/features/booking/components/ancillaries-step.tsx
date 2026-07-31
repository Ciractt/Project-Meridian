'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
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
             changed by hand whenever --color-chart or --radius-control move, or
             the seat map is the last magenta thing on a blue site. */
          styles: {
            accentColor: 'rgb(51, 80, 224)',
            buttonCornerRadius: '12px',
          },
          onPayloadReady: (
            data: { services?: SelectedService[] },
            _metadata: unknown,
          ) => {
            const services = data.services ?? [];
            setSelected(services);
            setChosenCount(services.length);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-sm text-airway underline underline-offset-2 hover:no-underline"
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
