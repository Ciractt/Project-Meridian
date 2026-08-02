'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import { ASSISTANCE_OPTIONS } from '../assistance-options';

const TITLES = [
  { value: 'mr', label: 'Mr' },
  { value: 'ms', label: 'Ms' },
  { value: 'mrs', label: 'Mrs' },
  { value: 'miss', label: 'Miss' },
  { value: 'dr', label: 'Dr' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  adult: 'Adult',
  child: 'Child',
  infant_without_seat: 'Infant',
};

/** Only what pre-fills a form. No documents — see ADR-047. */
export interface SavedTraveller {
  id: string;
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
  nickname: string | null;
}

export interface PassengerDraft {
  id: string;
  type: 'adult' | 'child' | 'infant_without_seat';
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
  passportNumber?: string;
  passportCountry?: string;
  passportExpiry?: string;
  /** Airport assistance, if this traveller asked for it. */
  assistance?: { codes: string[]; notes: string };
}

export function PassengerFields({
  index,
  passenger,
  errors,
  onChange,
  needsDocuments,
  saved,
}: {
  index: number;
  passenger: PassengerDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<PassengerDraft>) => void;
  /** From the offer. False for most short-haul fares. */
  needsDocuments: boolean;
  /** Saved travellers, if signed in. Empty for guests. */
  saved?: SavedTraveller[];
}) {
  const prefix = `passengers.${index}`;
  const error = (field: string) => errors[`${prefix}.${field}`];

  return (
    <fieldset className="rounded-card border border-hairline bg-surface p-5">
      <legend className="px-2 text-xs font-medium text-ink-faint">
        {TYPE_LABELS[passenger.type] ?? 'Traveller'} {index + 1}
      </legend>

      {/* Fills the fields and then gets out of the way. It does not lock
          them: a saved name is a starting point, and the one that reaches the
          airline is whatever is in the boxes when the form is submitted. Which
          is also why a saved traveller carries no passport details — those are
          typed per booking against the document being carried. */}
      {saved && saved.length > 0 ? (
        <label className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-faint">Use someone you’ve saved</span>
          <select
            value=""
            onChange={(event) => {
              const match = saved.find((person) => person.id === event.target.value);
              if (!match) return;
              onChange({
                title: match.title,
                givenName: match.givenName,
                familyName: match.familyName,
                bornOn: match.bornOn,
                gender: match.gender,
              });
            }}
            className="rounded-control border border-hairline-strong bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Choose…</option>
            {saved.map((person) => (
              <option key={person.id} value={person.id}>
                {person.nickname ?? `${person.givenName} ${person.familyName}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="mb-4 text-xs text-ink-muted">
        Enter names exactly as printed on the passport or ID being used to
        travel. A mismatch can mean being refused at the gate, and corrections
        after ticketing usually carry an airline fee.
      </p>

      <div className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
        <Select
          label="Title"
          value={passenger.title}
          error={error('title')}
          onChange={(value) => onChange({ title: value })}
          options={TITLES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <Input
          label="First name"
          value={passenger.givenName}
          error={error('givenName')}
          autoComplete="off"
          onChange={(value) => onChange({ givenName: value })}
        />
        <Input
          label="Last name"
          value={passenger.familyName}
          error={error('familyName')}
          autoComplete="off"
          onChange={(value) => onChange({ familyName: value })}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Date of birth"
          type="date"
          value={passenger.bornOn}
          error={error('bornOn')}
          onChange={(value) => onChange({ bornOn: value })}
        />
        <Select
          label="Sex as shown on your travel document"
          value={passenger.gender}
          error={error('gender')}
          onChange={(value) => onChange({ gender: value })}
          options={[
            { value: 'f', label: 'Female' },
            { value: 'm', label: 'Male' },
          ]}
          hint="Airline systems only accept these two values. This must match your document, not how you identify."
        />
      </div>

      {needsDocuments ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="mb-4 text-xs text-ink-muted">
            This airline requires passport details at the time of booking. They go
            straight to the airline — we don’t keep them.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Passport number"
              value={passenger.passportNumber ?? ''}
              error={error('passportNumber')}
              autoComplete="off"
              onChange={(value) => onChange({ passportNumber: value.toUpperCase() })}
            />
            <Input
              label="Issuing country"
              value={passenger.passportCountry ?? ''}
              error={error('passportCountry')}
              autoComplete="off"
              onChange={(value) => onChange({ passportCountry: value.toUpperCase() })}
            />
            <Input
              label="Expiry date"
              type="date"
              value={passenger.passportExpiry ?? ''}
              error={error('passportExpiry')}
              onChange={(value) => onChange({ passportExpiry: value })}
            />
          </div>
        </div>
      ) : null}

      {/* Asked here rather than only after booking, because this is the point
          of sale — the phrase EC 1107/2006 Art. 6 uses — and because it is
          earlier, which matters when the guarantee depends on 48 hours' notice.
          Collapsed by default: a checkout that asks everyone about disability
          is worse than one that makes it easy to find. */}
      <details className="mt-5 border-t border-hairline pt-4">
        <summary className="cursor-pointer text-xs font-medium text-ink">
          Need assistance at the airport?
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            We’ll pass this to the airline, who arrange it with the airport.
            It’s always free. Ask at least 48 hours before departure if you can —
            that’s when the airport is obliged to provide it.
          </p>

          {ASSISTANCE_OPTIONS.map((option) => (
            <label key={option.code} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={passenger.assistance?.codes.includes(option.code) ?? false}
                onChange={(event) => {
                  const current = passenger.assistance ?? { codes: [], notes: '' };
                  const codes = event.target.checked
                    ? [...current.codes, option.code]
                    : current.codes.filter((code) => code !== option.code);
                  onChange({ assistance: { ...current, codes } });
                }}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span>
                <span className="text-ink">{option.label}</span>
                {'detail' in option && option.detail ? (
                  <span className="block text-xs text-ink-faint">{option.detail}</span>
                ) : null}
              </span>
            </label>
          ))}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-faint">
              Anything else we should pass on
            </span>
            <textarea
              rows={2}
              value={passenger.assistance?.notes ?? ''}
              onChange={(event) => {
                const current = passenger.assistance ?? { codes: [], notes: '' };
                onChange({ assistance: { ...current, notes: event.target.value } });
              }}
              placeholder="Assistance dog, own wheelchair, anything the list doesn’t cover…"
              className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
            />
            {/* Six codes do not describe every need. Saying so stops someone
                concluding their requirement is not catered for. */}
            <span className="mt-1 block text-xs text-ink-faint">
              Describing it in your own words is enough on its own.
            </span>
          </label>
        </div>
      </details>
    </fieldset>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  /* useId, not Math.random(). The server and the client each rendered their own
     random suffix, so the ids never matched and React discarded the tree with a
     hydration mismatch. useId is stable across both by design — which is what it
     exists for. */
  const id = useId();
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
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'mt-1.5 w-full rounded-control border bg-surface px-3 py-2.5 text-sm text-ink',
          error ? 'border-danger' : 'border-hairline-strong',
        )}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  hint?: string;
}) {
  const id = `s-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-ink-faint"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'mt-1.5 w-full rounded-control border bg-surface px-3 py-2.5 text-sm text-ink',
          error ? 'border-danger' : 'border-hairline-strong',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
