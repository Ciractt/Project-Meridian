import { cn } from '@/lib/cn';

/**
 * Where you are in checkout.
 *
 * Four steps, named for what happens rather than what we call it internally.
 * "Extras" is omitted when the airline sells none, because a greyed-out step for
 * something that will never appear tells the traveller the flow is longer than
 * it is.
 *
 * Not a link — you cannot jump back to a completed step, because going back
 * means re-pricing and possibly re-taking a payment intent. Showing progress and
 * offering navigation are different things, and only the first is honest here.
 */
export type CheckoutStep = 'details' | 'extras' | 'payment' | 'done';

export function CheckoutSteps({
  current,
  includeExtras,
}: {
  current: CheckoutStep;
  includeExtras: boolean;
}) {
  const steps: Array<{ key: CheckoutStep; label: string }> = [
    { key: 'details', label: 'Travellers' },
    ...(includeExtras ? [{ key: 'extras' as const, label: 'Bags and seats' }] : []),
    { key: 'payment', label: 'Payment' },
    { key: 'done', label: 'Confirmed' },
  ];

  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';

        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]',
                state === 'done' && 'bg-positive text-white',
                state === 'current' && 'bg-chart text-white',
                state === 'todo' && 'border border-hairline-strong text-ink-faint',
              )}
              aria-hidden="true"
            >
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span
              className={cn(
                state === 'current' ? 'font-medium text-ink' : 'text-ink-faint',
              )}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="mx-1 h-px w-6 bg-hairline" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
