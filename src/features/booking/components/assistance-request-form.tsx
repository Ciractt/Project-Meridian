'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestAssistance } from '../assistance-actions';
import { ASSISTANCE_OPTIONS, type AssistanceRequest, type AssistanceResult } from '../assistance';

/**
 * Asking for help at the airport.
 *
 * ## What this promises, and what it carefully does not
 *
 * We can say we have the request and that we pass it to the airline. We cannot
 * say assistance is arranged — the airport provides it, the airline books it,
 * and neither confirms back to us. Every string here holds that line, because
 * the failure mode of blurring it is somebody arriving at a terminal expecting
 * a wheelchair that nobody ordered.
 *
 * So it also gives them the airline's own channel. Belt and braces on an
 * accessibility need is not clutter: it is the difference between one route to
 * a wheelchair and two, and we are the one that cannot confirm.
 *
 * ## The 48 hours
 *
 * Stated up front rather than in small print, because it is the single fact
 * that decides whether the assistance actually happens. Under EC 1107/2006 the
 * airport is obliged to provide assistance when notice was given 48 hours
 * before departure; inside that window they must make every reasonable effort,
 * which is a weaker promise and honestly described as one.
 *
 * ## Free text is a first-class option
 *
 * Six SSR codes do not describe every need. A form that refuses a request
 * because it does not match a checkbox is the failure this feature exists to
 * prevent, so notes alone constitute a valid request.
 */
export function AssistanceRequestForm({
  orderId,
  isOwner,
  existing,
}: {
  orderId: string;
  isOwner: boolean;
  existing: AssistanceRequest[];
}) {
  const [state, action, pending] = useActionState<AssistanceResult | null, FormData>(
    requestAssistance,
    null,
  );
  const [email, setEmail] = useState('');

  return (
    <details className="rounded-card border border-hairline bg-surface p-5">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Request assistance at the airport
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        {existing.length > 0 ? (
          <ul className="space-y-2">
            {existing.map((request) => (
              <li key={request.id} className="rounded-card border border-hairline p-4">
                <p className="font-medium text-ink">{request.passengerLabel}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {request.codes
                    .map(
                      (code) =>
                        ASSISTANCE_OPTIONS.find((option) => option.code === code)
                          ?.label ?? code,
                    )
                    .join(' · ')}
                  {request.notes ? ` · ${request.notes}` : ''}
                </p>
                {/* "Sent to the airline" and "assistance is booked" are
                    different sentences and this one is the true one. */}
                <p className="mt-2 text-xs text-positive">
                  {request.status === 'forwarded'
                    ? 'Sent to the airline. They arrange it with the airport — check with them if you want it confirmed.'
                    : 'We have this and are passing it to the airline.'}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {state?.status === 'received' ? (
          <div className="rounded-card border border-positive/40 bg-positive-wash p-4">
            <p className="font-medium text-ink">We’ve got it.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              We’ll pass this to the airline. They and the airport arrange the
              assistance itself, so we can’t confirm it on their behalf —{' '}
              <strong>if it matters, call the airline too</strong> and quote your
              booking reference. Assistance is always free.
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} />

            <p className="leading-relaxed text-ink-muted">
              Tell us what you need and we’ll pass it to the airline. Ask at least{' '}
              <strong>48 hours before departure</strong> — inside that window the
              airport still has to make every reasonable effort, but the guarantee
              only applies with 48 hours’ notice. There’s never a charge for
              assistance.
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-faint">
                Who is it for?
              </span>
              <input
                name="passengerLabel"
                required
                placeholder="Name as it appears on the booking"
                className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-ink-faint">
                What’s needed?
              </legend>
              {ASSISTANCE_OPTIONS.map((option) => (
                <label key={option.code} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="codes"
                    value={option.code}
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="text-ink">{option.label}</span>
                    {'detail' in option && option.detail ? (
                      <span className="block text-xs text-ink-faint">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-faint">
                Anything else we should pass on
              </span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Travelling with an assistance dog, own wheelchair with a lithium battery, anything the list above doesn’t cover…"
                className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-ink-faint">
                Describing it in your own words is fine on its own — you don’t have
                to tick anything above.
              </span>
            </label>

            {!isOwner ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-faint">
                  The email this booking was made with
                </span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <Button type="submit" variant="secondary" loading={pending}>
              Send this to the airline
            </Button>

            {state ? (
              <p className="text-danger">
                {state.status === 'forbidden'
                  ? 'That email doesn’t match this booking.'
                  : state.message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </details>
  );
}
