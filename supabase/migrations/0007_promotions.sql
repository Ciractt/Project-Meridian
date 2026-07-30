-- Homepage promotions.
--
-- Editable by admins, read by everyone. Two columns exist for legal reasons
-- rather than product ones, and they are not optional:
--
--   is_paid_placement — when true, the banner MUST carry a visible partnership
--                       label. Advertising has to be identifiable as
--                       advertising; an unlabelled paid banner dressed as
--                       editorial recommendation is exactly what the ASA and
--                       the CMA act on.
--   terms_href        — a savings claim ("up to 20% off") needs somewhere the
--                       reader can check what it applies to. Under the DMCC
--                       Act a headline saving without accessible terms is a
--                       misleading practice.
--
-- The application refuses to save a paid placement without a partner name, and
-- refuses a headline containing a savings claim without terms. Enforcing that in
-- code rather than trusting the person filling the form is deliberate: the person
-- filling the form is under commercial pressure to ship the banner.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),

  headline text not null,
  subhead text,
  -- Rendered with a plain <img>, so any host works without touching
  -- next.config. Deliberate: promo art comes from partners at short notice.
  image_url text,
  -- Tailwind gradient classes for when there's no image.
  background_class text default 'bg-gradient-to-br from-night via-chart/40 to-airway/40',

  cta_label text,
  cta_href text,

  /* Disclosure */
  partner_name text,
  is_paid_placement boolean not null default false,
  terms_href text,

  /* Scheduling */
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  priority smallint not null default 0,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- A paid placement with nobody to name cannot be disclosed, so it cannot be
  -- stored. Enforced here as well as in the application, because a constraint
  -- outlives the code path that was supposed to check it.
  constraint paid_placement_needs_partner
    check (not is_paid_placement or partner_name is not null)
);

alter table public.promotions enable row level security;

create index if not exists promotions_live_idx
  on public.promotions (active, priority desc, created_at desc);

-- Anyone may read a promotion that is currently live. This is public marketing
-- copy, so a public read policy is more honest than routing the home page
-- through the service role — and it means the home page needs no secret key.
create policy "promotions_select_live"
  on public.promotions for select
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- No insert, update or delete policy. Admin writes go through the service role.
