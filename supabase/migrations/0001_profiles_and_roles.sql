-- Auth foundation.
--
-- Two tables, deliberately separate:
--
--   profiles    — user-editable details. RLS lets a user read and write their
--                 own row and nobody else's.
--   user_roles  — privilege. Users may READ their own role and nothing else.
--                 There is no insert, update or delete policy at all, so the
--                 anon and authenticated keys cannot grant privilege even if
--                 an attacker fully controls the client. Roles are assigned by
--                 the service role or by hand in SQL.
--
-- Keeping role out of `profiles` is the whole point. A single table with a
-- `role` column and an "update your own row" policy is a privilege-escalation
-- bug waiting to happen: the client can PATCH its own role to 'admin'.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.app_role as enum ('customer', 'support', 'admin');

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  granted_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Profiles: own row only.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Roles: read own only. No write policies by design.
create policy "user_roles_select_own"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- Give every new user a profile and the 'customer' role automatically, so
-- application code never has to handle a half-created account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Promote yourself once, by hand, from the Supabase SQL editor:
--   update public.user_roles set role = 'admin'
--   where user_id = (select id from auth.users where email = 'you@example.com');
