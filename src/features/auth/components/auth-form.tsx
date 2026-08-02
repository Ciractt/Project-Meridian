'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { AuthFormState } from '../actions';

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  mode: 'sign-in' | 'sign-up';
  next?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === 'sign-up' ? (
        <Field label="Full name" name="fullName" type="text" autoComplete="name" />
      ) : null}

      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        required
        hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
      />

      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-accent-wash px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p
          role="status"
          className="rounded-control bg-positive-wash px-3 py-2 text-sm text-positive"
        >
          {state.notice}
        </p>
      ) : null}

      <Button type="submit" variant="accent" loading={pending} className="w-full">
        {mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `field-${name}`;
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
        autoComplete={autoComplete}
        required={required}
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
