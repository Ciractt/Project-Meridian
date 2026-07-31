'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from '@/features/auth/actions';
import type { AppRole } from '@/features/auth/types';

/**
 * Account and tasks, in a panel off the right edge.
 *
 * The header was three inline links that grew by one every time something was
 * added. A panel holds the same things without the header having to.
 *
 * **This is not a second sitemap.** The footer is the sitemap — Who we are,
 * pricing promise, terms, popular routes, all of it. Duplicating that here
 * would be two lists to keep in step and one of them would rot. This panel is
 * what you came to *do*: find a booking, change a detail, get help, sign in or
 * out. If a link belongs in both, it belongs in the footer.
 *
 * Nothing in it leads nowhere. ADR-035's rule for the home page applies harder
 * to a grid of tiles: an inviting tile for a feature we don't have buys a
 * moment of density and costs the trust the rest of the product is spending
 * its time earning. Which is why this has five tiles and the reference has
 * eight — they have more things.
 *
 * Native <dialog>, matching TripDetailsDialog and FilterSheet: focus trapping,
 * Escape, inert background and the top layer come out correct without writing
 * any of it.
 */
export function NavPanel({
  user,
}: {
  /** Only what gets rendered. The id and anything else stay on the server. */
  user: { firstName: string | null; role: AppRole } | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const isStaff = user?.role === 'admin' || user?.role === 'support';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-control border border-hairline-strong px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
      >
        {user ? (user.firstName ? `Hi, ${user.firstName}` : 'Account') : 'Sign in'}
        <span aria-hidden="true" className="text-ink-faint">
          ☰
        </span>
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label="Account and navigation"
        /* A modal dialog is already positioned, so an explicit inset is
           unambiguous where margin utilities would fight each other. `open:`
           rather than a bare display value, or the closed panel renders. */
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="fixed top-0 right-0 bottom-0 left-auto m-0 h-dvh w-full max-w-md bg-surface p-0 backdrop:bg-ink/50 open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
          <p className="font-display text-2xl font-extrabold tracking-tight">
            {user?.firstName ? (
              <>
                Hello,
                <br />
                {user.firstName}.
              </>
            ) : (
              'Hello.'
            )}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-muted hover:border-ink hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {!user ? (
            <div className="mb-8 space-y-3">
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="block rounded-control bg-chart px-4 py-3 text-center text-sm font-medium text-white"
              >
                Sign in
              </Link>
              <p className="text-sm text-ink-muted">
                No account?{' '}
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="text-airway underline underline-offset-2"
                >
                  Create one
                </Link>
                . You can book as a guest without one.
              </p>
            </div>
          ) : null}

          <Section title="Trips">
            <Tile href="/" onNavigate={() => setOpen(false)}>
              Search flights
            </Tile>
            {user ? (
              <Tile href="/account" onNavigate={() => setOpen(false)}>
                Your bookings
              </Tile>
            ) : null}
          </Section>

          {user ? (
            <Section title="Account">
              <Tile href="/account/settings" onNavigate={() => setOpen(false)}>
                Your details
              </Tile>
              {isStaff ? (
                <Tile href="/admin" onNavigate={() => setOpen(false)}>
                  Admin
                </Tile>
              ) : null}
            </Section>
          ) : null}

          <Section title="Help">
            <Tile href="/help" onNavigate={() => setOpen(false)}>
              Help centre
            </Tile>
            <Tile
              href="/help/changes-and-refunds"
              onNavigate={() => setOpen(false)}
            >
              Changes and refunds
            </Tile>
          </Section>

          {user ? (
            <form action={signOut} className="mt-8 border-t border-hairline pt-6">
              <button
                type="submit"
                className="text-sm text-airway underline underline-offset-2 hover:no-underline"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 text-xs font-medium text-ink-faint">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Tile({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-20 items-end rounded-card border border-hairline bg-surface p-4 text-sm font-medium text-ink transition-colors hover:border-hairline-strong hover:bg-paper"
    >
      {children}
    </Link>
  );
}
