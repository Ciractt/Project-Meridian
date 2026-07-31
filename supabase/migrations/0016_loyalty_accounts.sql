-- Frequent-flyer numbers a traveller has saved.
--
-- Stored on the profile so nobody retypes a fifteen-digit membership number on
-- every booking. Sent to the airline at search-refinement time, never used for
-- anything else — this is not a marketing signal and is not shared.
--
-- jsonb rather than a table: it is a short list belonging entirely to one person,
-- always read and written whole, and never queried across users.

alter table public.profiles
  add column if not exists loyalty_accounts jsonb not null default '[]'::jsonb;

comment on column public.profiles.loyalty_accounts is
  'Array of { airline, accountNumber }. Passed to airlines to claim member '
  'benefits and accrue points. Never used for segmentation or shared onward.';
