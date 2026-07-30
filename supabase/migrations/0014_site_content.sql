-- Editable site copy.
--
-- One key/value table rather than a column per field, because the alternative is
-- a migration every time a sentence needs changing — which means it doesn't get
-- changed.
--
-- Values are jsonb so a key can hold a structure (an announcement with a link and
-- an end date) as easily as a string. Typed accessors in
-- `features/content/queries.ts` give each key a shape and a default, so the site
-- renders correctly against an entirely empty table.
--
-- Public read: this is site copy, and routing the home page through the service
-- role to fetch its own headline would be silly. Writes are service-role only.

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_content enable row level security;

create policy "site_content_select_all"
  on public.site_content for select
  using (true);

-- No write policies. Admin edits go through the service role.
