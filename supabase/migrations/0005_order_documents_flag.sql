-- Did the traveller give us passport details at booking?
--
-- A boolean, not the documents. This tells the confirmation page whether to
-- tell someone they still need to add passport details with the airline, which
-- is the single most common reason a valid booking fails at check-in.
--
-- Storing the fact is fine; storing the documents is not, and there is still no
-- column for those (ADR-018).

alter table public.orders
  add column if not exists documents_provided boolean not null default false;
