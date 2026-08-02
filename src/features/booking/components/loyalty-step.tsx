'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { applyLoyalty } from '../loyalty-actions';
import type { ApplyResult, LoyaltyAccount } from '../loyalty';

/**
 * Frequent-flyer number entry, before payment.
 *
 * Only rendered when the offer actually supports a programme — Duffel ignore
 * accounts for unsupported airlines at booking, so offering the field regardless
 * would collect a number, say nothing, and quietly do nothing with it.
 *
 * The airline decides what to give back. We say what might change rather than
 * promising a discount, because most of the time nothing changes and a promise
 * that usually fails is worse than no offer at all.
 */
export function LoyaltyStep({
  offerId,
  passengerIds,
  supportedProgrammes,
  saved,
  defaultGivenName,
  defaultFamilyName,
}: {
  offerId: string;
  passengerIds: string[];
  supportedProgrammes: string[];
  saved: LoyaltyAccount[];
  defaultGivenName: string;
  defaultFamilyName: string;
}) {
  const [result, action, pending] = useActionState<ApplyResult | null, FormData>(
    applyLoyalty,
    null,
  );
  const [airline, setAirline] = useState(supportedProgrammes[0] ?? '');

  if (supportedProgrammes.length === 0) return null;

  const savedForAirline = saved.find((account) => account.airline === airline);

  if (result?.status === 'applied') {
    return (
      <section
        role="status"
        className="rounded-card border border-positive/30 bg-positive-wash p-5"
      >
        <h2 className="font-display text-base font-bold tracking-tight">
          Membership number added
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Sent to the airline. If it changed the fare, your baggage or your seat
          options, the details above now reflect it.
        </p>
      </section>
    );
  }

  return (
    <details className="rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Add a frequent flyer number
      </summary>

      <form action={action} className="space-y-4 border-t border-hairline px-6 py-5">
        <input type="hidden" name="offerId" value={offerId} />
        <input type="hidden" name="passengerIds" value={passengerIds.join(',')} />
        <input
          type="hidden"
          name="supportedProgrammes"
          value={supportedProgrammes.join(',')}
        />

        <p className="text-sm leading-relaxed text-ink-muted">
          Some airlines lower the fare, add baggage or open up seat selection for
          members — and you’ll earn points on the flight either way. We send it to
          the airline and show you whatever comes back.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="loyalty-airline"
              className="block text-xs font-medium text-ink-faint"
            >
              Programme
            </label>
            <select
              id="loyalty-airline"
              name="airline"
              value={airline}
              onChange={(event) => setAirline(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
            >
              {supportedProgrammes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <Field
            name="accountNumber"
            label="Membership number"
            defaultValue={savedForAirline?.accountNumber ?? ''}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="givenName"
            label="Given names on the account"
            defaultValue={defaultGivenName}
            required
          />
          <Field
            name="familyName"
            label="Family name on the account"
            defaultValue={defaultFamilyName}
            required
          />
        </div>
        <p className="text-xs text-ink-faint">
          Airlines check the name against the membership, so it has to match the
          account rather than the ticket if those differ.
        </p>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-4 accent-[var(--color-accent)]"
          />
          Remember this for next time
        </label>

        {result ? (
          <p role="alert" className="rounded-control bg-caution-wash p-3 text-sm text-caution">
            {result.message}
          </p>
        ) : null}

        <Button type="submit" variant="secondary" loading={pending}>
          Send to the airline
        </Button>
      </form>
    </details>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = `loyalty-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-ink-faint"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
      />
    </div>
  );
}
