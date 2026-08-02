-- People a traveller books for, saved so their details aren't retyped.
--
-- ## What this stores, and what it deliberately does not
--
-- Name, date of birth, title and gender. **No identity documents.** ADR-018
-- says passport numbers are never persisted and that holds here without
-- qualification — they are still typed per booking, against the document
-- actually being carried, and passed straight through to Duffel. Saving them
-- would turn a convenience feature into the most valuable table in the
-- database.
--
-- ## Why a table rather than jsonb on profiles
--
-- `loyalty_accounts` is jsonb because it is a short list always read and
-- written whole. These are different: each row is edited and deleted on its
-- own, which through jsonb is a read-modify-write and a lost update when two
-- tabs disagree. A row per traveller also means a delete is a delete rather
-- than a rewrite of the survivors.
--
-- ## Whose data is this
--
-- Mostly somebody else's. An account holder saving their partner and children
-- is entering personal data about people who never agreed to anything here, and
-- that is the reason for the shape above: the minimum needed to fill a form,
-- nothing that identifies a document, and deletion that is one click and
-- immediate. `on delete cascade` means closing an account takes the family with
-- it rather than leaving orphans nobody can reach.

create table if not exists public.traveller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- As it appears on the travel document. Editable, always — locking a legal
  -- name strands anyone who marries, divorces or changes it, and buys nothing,
  -- because the name that reaches the airline is the one typed at checkout.
  title text,
  given_name text not null,
  family_name text not null,
  born_on date,
  gender text,

  -- What the account holder calls this person. Optional: "Mum" is a better
  -- label in a dropdown than a legal name, and some people will not want one.
  nickname text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.traveller_profiles enable row level security;

-- Own rows only, in every direction. There is no read path for anyone else and
-- no admin policy: support has no reason to browse a family's dates of birth,
-- and a policy that exists is a policy that gets used.
create policy "traveller_profiles_select_own"
  on public.traveller_profiles for select
  using (auth.uid() = user_id);

create policy "traveller_profiles_insert_own"
  on public.traveller_profiles for insert
  with check (auth.uid() = user_id);

create policy "traveller_profiles_update_own"
  on public.traveller_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "traveller_profiles_delete_own"
  on public.traveller_profiles for delete
  using (auth.uid() = user_id);

create index if not exists traveller_profiles_user_idx
  on public.traveller_profiles (user_id, created_at);

comment on table public.traveller_profiles is
  'People an account holder books for. Names, dates of birth and titles only — '
  'never identity documents (ADR-018). Deleted with the account.';
