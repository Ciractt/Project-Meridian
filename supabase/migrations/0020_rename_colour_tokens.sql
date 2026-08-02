-- Colour tokens renamed: chart → accent, airway → link.
--
-- Almost all of that rename is a find-and-replace across source files. This
-- column is the exception, and it is the interesting one: `background_class`
-- holds Tailwind class names as *data*, so a rename in the code does not reach
-- it. Tailwind stops emitting `via-chart/40`, the stored string keeps asking
-- for it, and every promotion silently loses its gradient. Nothing errors —
-- the class just resolves to nothing.
--
-- It was caught by diffing the compiled stylesheet before and after the rename
-- rather than by any test, which is worth recording: a class name in a database
-- is invisible to the compiler, invisible to typecheck, and invisible to the
-- test suite.
--
-- Updates the default and every existing row. Idempotent — replace() on a
-- string that no longer contains the old token is a no-op.

alter table public.promotions
  alter column background_class
  set default 'bg-gradient-to-br from-night via-accent/40 to-link/40';

update public.promotions
set background_class =
  replace(
    replace(background_class, 'chart', 'accent'),
    'airway', 'link'
  )
where background_class like '%chart%'
   or background_class like '%airway%';
