'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createPromotion, type PromotionFormState } from '../actions';

export function PromotionForm() {
  const [state, formAction, pending] = useActionState<PromotionFormState, FormData>(
    createPromotion,
    {},
  );
  const [isPaid, setIsPaid] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <Field name="headline" label="Headline" required maxLength={80} />
      <Field name="subhead" label="Supporting line" maxLength={160} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="ctaLabel" label="Button text" maxLength={30} />
        <Field name="ctaHref" label="Button links to" placeholder="/search?..." />
      </div>

      <Field
        name="imageUrl"
        label="Background image URL"
        placeholder="https://…"
        hint="Optional. A gradient is used when empty."
      />

      <div className="rounded-card border border-hairline bg-paper p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="isPaidPlacement"
            checked={isPaid}
            onChange={(event) => setIsPaid(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            <span className="block font-medium text-ink">
              An airline is paying for this placement
            </span>
            <span className="mt-1 block text-xs text-ink-muted">
              Adds an “Ad” label to the banner. Required by law when placement is
              paid for — advertising has to be identifiable as advertising.
            </span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="partnerName"
            label="Partner name"
            required={isPaid}
            hint={isPaid ? 'Required — it appears in the label.' : 'Optional.'}
          />
          <Field
            name="termsHref"
            label="Terms link"
            placeholder="/terms/summer-sale"
            hint="Required if the headline mentions a discount or saving."
          />
        </div>
      </div>

      <Field
        name="endsAt"
        label="Stops showing after"
        type="datetime-local"
        hint="Optional. A sale banner outliving the sale is a misleading claim."
      />

      {state.error ? (
        <p role="alert" className="rounded-control bg-accent-wash px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-control bg-positive-wash px-3 py-2 text-sm text-positive">
          {state.notice}
        </p>
      ) : null}

      <Button type="submit" variant="accent" loading={pending}>
        Save as inactive
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  maxLength,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
}) {
  const id = `promo-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-ink-faint"
      >
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-ink"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
