'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  changeEmail,
  changePassword,
  saveAddress,
  saveTravellerName,
  type ProfileState,
} from '../profile-actions';

interface Profile {
  passportGivenName: string;
  passportFamilyName: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressPostcode: string;
  addressCountry: string;
}

export function TravellerNameForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    saveTravellerName,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-muted">
        Enter your names exactly as they appear on the passport you travel with. We
        use this to fill in booking forms — you can always change it there, and
        we’ll always ask you to check before you pay.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="givenName" label="Given names" defaultValue={profile.passportGivenName} />
        <Field name="familyName" label="Family name" defaultValue={profile.passportFamilyName} />
      </div>

      <Result state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Save name
      </Button>
    </form>
  );
}

export function AddressForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    saveAddress,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-muted">
        Optional. We don’t need an address to sell you a flight and never ask for one
        at checkout — this is only here if you want it on an invoice.
      </p>

      <Field name="line1" label="Address" defaultValue={profile.addressLine1} />
      <Field name="line2" label="Address line 2" defaultValue={profile.addressLine2} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="city" label="Town or city" defaultValue={profile.addressCity} />
        <Field name="postcode" label="Postcode" defaultValue={profile.addressPostcode} />
        <Field name="country" label="Country" defaultValue={profile.addressCountry} />
      </div>

      <Result state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Save address
      </Button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    changeEmail,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-muted">
        Currently <span className="font-mono text-ink">{currentEmail}</span>. We’ll
        send a confirmation link to the new address — nothing changes until you click
        it, so a typo can’t lock you out.
      </p>

      <Field name="email" label="New email" type="email" required />
      <Result state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Send confirmation
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters. Longer beats complicated."
      />
      <Field
        name="confirm"
        label="Repeat it"
        type="password"
        autoComplete="new-password"
        required
      />
      <Result state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

function Result({ state }: { state: ProfileState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-control bg-chart-wash px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="rounded-control bg-positive-wash px-3 py-2 text-sm text-positive">
        {state.notice}
      </p>
    );
  }
  return null;
}

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
  required,
  hint,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  const id = `settings-${name}`;
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
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
      />
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
