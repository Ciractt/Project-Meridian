'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveAnnouncement, saveHero, type ContentFormState } from '../actions';
import type { Announcement, HeroCopy } from '../queries';

export function AnnouncementForm({ initial }: { initial: Announcement }) {
  const [state, action, pending] = useActionState<ContentFormState, FormData>(
    saveAnnouncement,
    {},
  );
  const [active, setActive] = useState(initial.active);

  return (
    <form action={action} className="space-y-4">
      <Field
        name="text"
        label="Message"
        defaultValue={initial.text}
        maxLength={160}
        hint="Leave empty to hide the strip entirely."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="href" label="Links to" defaultValue={initial.href} placeholder="/help" />
        <Field
          name="linkLabel"
          label="Link text"
          defaultValue={initial.linkLabel}
          maxLength={40}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="announcement-tone"
            className="block text-xs font-medium text-ink-faint"
          >
            Style
          </label>
          <select
            id="announcement-tone"
            name="tone"
            defaultValue={initial.tone}
            className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
          >
            <option value="info">Standard (dark)</option>
            <option value="caution">Attention (amber)</option>
          </select>
        </div>

        <Field
          name="endsAt"
          label="Hide after"
          type="datetime-local"
          defaultValue={initial.endsAt ? initial.endsAt.slice(0, 16) : ''}
          hint="Strongly recommended — it disappears on its own."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        Show this strip
      </label>

      <Result state={state} />
      <Button type="submit" variant="accent" loading={pending}>
        Save strip
      </Button>
    </form>
  );
}

export function HeroForm({ initial }: { initial: HeroCopy }) {
  const [state, action, pending] = useActionState<ContentFormState, FormData>(
    saveHero,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <Field
        name="eyebrow"
        label="Small label above"
        defaultValue={initial.eyebrow}
        maxLength={40}
      />
      <Field
        name="headline"
        label="Headline"
        defaultValue={initial.headline}
        maxLength={90}
        required
      />
      <Field
        name="subhead"
        label="Supporting line"
        defaultValue={initial.subhead}
        maxLength={200}
        hint="Optional. Leave empty and the search bar sits closer to the headline."
      />
      <Result state={state} />
      <Button type="submit" variant="accent" loading={pending}>
        Save headline
      </Button>
    </form>
  );
}

function Result({ state }: { state: ContentFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-control bg-accent-wash px-3 py-2 text-sm text-danger">
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
  maxLength,
  placeholder,
  hint,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = `content-${name}`;
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
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
      />
      {hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
