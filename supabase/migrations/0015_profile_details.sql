-- Profile details a traveller can maintain.
--
-- `passport_name` is a convenience, NOT a source of truth. Passenger names are
-- still entered and confirmed per booking against the document being used, and
-- still never stored (ADR-018) — this only pre-fills the form so a solo traveller
-- isn't retyping their own name every time.
--
-- It is deliberately EDITABLE. Locking a legal name permanently would strand
-- anyone who marries, divorces, changes it by deed poll or obtains a gender
-- recognition certificate, and it buys nothing: the name that reaches the airline
-- is the one typed at checkout regardless of what is stored here.
--
-- Address is optional and unused by the booking flow. Duffel doesn't need it and
-- we don't ask for it at checkout; it exists only for people who want an invoice
-- with an address on it. Optional because unused personal data is a liability,
-- not a feature.

alter table public.profiles
  add column if not exists passport_given_name text,
  add column if not exists passport_family_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_city text,
  add column if not exists address_postcode text,
  add column if not exists address_country text;

comment on column public.profiles.passport_given_name is
  'Pre-fills the booking form. Not authoritative — the name sent to the airline '
  'is always the one confirmed at checkout against the actual document.';
