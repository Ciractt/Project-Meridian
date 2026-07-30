-- Confirmation email send flag.
--
-- A guest who closes the tab loses their booking reference unless they were
-- sent it. `completeBooking` (synchronous ticketing) and the `order.created`
-- webhook (orders that resolved from a 202) both now send a confirmation, and
-- both may run for the same order — the webhook is at-least-once and retried
-- for 72 hours. So the send has to be claimed before it happens, the same way
-- booking attempts and webhook events are claimed.
--
-- This column IS the claim. The send does an atomic
--   update orders set confirmation_email_sent_at = now()
--     where id = ? and confirmation_email_sent_at is null
-- Postgres row-locking makes exactly one caller win the null → timestamp
-- transition; every later caller matches zero rows and skips. A successful send
-- never clears the flag, so a redelivery — or the webhook firing after
-- completeBooking already sent — cannot send a second time.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'When the confirmation email was claimed for sending. Set atomically before '
  'the send as an at-most-once guard shared by completeBooking and the '
  'order.created webhook. Never cleared once set.';
