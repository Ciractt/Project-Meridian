'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  deleteTravellerProfile,
  saveTravellerProfile,
  type TravellerProfile,
  type TravellerState,
} from '../travellers';

const TITLES = [
  { value: 'mr', label: 'Mr' },
  { value: 'ms', label: 'Ms' },
  { value: 'mrs', label: 'Mrs' },
  { value: 'miss', label: 'Miss' },
  { value: 'dr', label: 'Dr' },
];

/**
 * People this account books for.
 *
 * The section says what is stored and what is not, in the section itself rather
 * than in a policy page. Most of these entries will be somebody's children, and
 * a parent typing a child's date of birth into a website is entitled to know
 * where it stops — so the answer is on the screen where they type it, not two
 * clicks away.
 */
export function TravellerProfiles({ travellers }: { travellers: TravellerProfile[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-muted">
        Saved so you’re not retyping the same names and dates every time. We keep
        the name, date of birth and title — <strong>never passport details</strong>,
        which you enter per booking against the document you’re actually
        travelling with. Remove anyone here and they’re gone immediately.
      </p>

      {travellers.length > 0 ? (
        <ul className="space-y-2">
          {travellers.map((traveller) => (
            <li key={traveller.id} className="rounded-card border border-hairline p-4">
              {editing === traveller.id ? (
                <TravellerForm
                  traveller={traveller}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-ink">
                      {traveller.givenName} {traveller.familyName}
                    </span>
                    {traveller.nickname ? (
                      <span className="ml-2 text-xs text-ink-faint">
                        {traveller.nickname}
                      </span>
                    ) : null}
                    <span className="block tabular-nums text-xs text-ink-faint">
                      {traveller.bornOn}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(traveller.id)}
                      className="text-xs text-link underline underline-offset-2"
                    >
                      Edit
                    </button>
                    <RemoveButton id={traveller.id} name={traveller.givenName} />
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="rounded-card border border-hairline p-4">
          <TravellerForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          Add someone
        </Button>
      )}
    </div>
  );
}

function TravellerForm({
  traveller,
  onDone,
}: {
  traveller?: TravellerProfile;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<TravellerState, FormData>(
    saveTravellerProfile,
    {},
  );

  /* Closing on the success notice rather than on submit: a validation failure
     has to leave the form open with the message on it. In an effect because
     calling a parent's setState during render is a React error, not a style
     preference. */
  useEffect(() => {
    if (state.notice) onDone();
  }, [state.notice, onDone]);

  return (
    <form action={action} className="space-y-3">
      {traveller ? <input type="hidden" name="id" value={traveller.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
        <Field label="Title">
          <select
            name="title"
            defaultValue={traveller?.title ?? 'mr'}
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          >
            {TITLES.map((title) => (
              <option key={title.value} value={title.value}>
                {title.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First name">
          <input
            name="givenName"
            defaultValue={traveller?.givenName ?? ''}
            required
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Last name">
          <input
            name="familyName"
            defaultValue={traveller?.familyName ?? ''}
            required
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date of birth">
          <input
            type="date"
            name="bornOn"
            defaultValue={traveller?.bornOn ?? ''}
            required
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Gender">
          <select
            name="gender"
            defaultValue={traveller?.gender ?? 'f'}
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="f">Female</option>
            <option value="m">Male</option>
          </select>
        </Field>
        <Field label="Label (optional)">
          <input
            name="nickname"
            defaultValue={traveller?.nickname ?? ''}
            placeholder="Mum, Alex…"
            className="w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {/* Airlines match the travel document, and a mismatch is a rebooking at
          the airport rather than a correction at the desk. Said once, here,
          where the name is typed. */}
      <p className="text-xs text-ink-faint">
        Use the names exactly as they appear on the passport or ID being used.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          Save
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-ink-faint underline underline-offset-2"
        >
          Cancel
        </button>
        {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}

/**
 * Two steps, and the name is in the confirmation.
 *
 * A list of similar rows is the easiest place to delete the wrong one, and
 * these are other people. "Remove Alex?" is answerable; "Are you sure?" is not.
 */
function RemoveButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<TravellerState, FormData>(
    deleteTravellerProfile,
    {},
  );
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs text-ink-faint underline underline-offset-2"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-ink-muted">Remove {name}?</span>
      <Button type="submit" variant="secondary" loading={pending}>
        Yes
      </Button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-ink-faint underline underline-offset-2"
      >
        No
      </button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
