'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Plane,
  RefreshCcw,
  ShieldCheck,
  Ticket,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/features/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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
export function NavPanel() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const user = useViewer();

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
        /* Positioned by margin, not by inset. The first attempt set `fixed`
           with explicit insets and opened on the left — the UA's own
           `inset-inline` rules for a modal dialog do not give way as cleanly as
           they look like they should. TripDetailsDialog already carries a
           comment about this exact trap; the fix is to use the mechanism that
           works there. `margin: auto` centres a dialog, so auto on one side and
           zero on the other pushes it to the opposite edge.

           `max-h-none` because the UA caps a dialog at 100% minus 12px, which
           would leave a hairline of backdrop under a full-height sheet.

           `open:` rather than a bare display value, or the closed panel
           renders. */
        /* Clicking the backdrop closes. A click on ::backdrop hit-tests as a
           click on the dialog element itself, so the target check is what
           separates "outside the panel" from "on something in it" — it holds
           because these dialogs have p-0 and their content fills them. */
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="mt-0 mr-0 mb-0 ml-auto h-dvh max-h-none w-full max-w-md bg-surface p-0 backdrop:bg-ink/50 open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
          <p className="font-display text-2xl font-extrabold tracking-tight">
            Hello
            {user?.firstName ? (
              <>
                ,<br />
                <span className="text-accent">{user.firstName}.</span>
              </>
            ) : (
              '.'
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
                className="block rounded-control bg-accent px-4 py-3 text-center text-sm font-medium text-white"
              >
                Sign in
              </Link>
              <p className="text-sm text-ink-muted">
                No account?{' '}
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="text-link underline underline-offset-2"
                >
                  Create one
                </Link>
                . You can book as a guest without one.
              </p>
            </div>
          ) : null}

          <Section title="Trips">
            <Tile href="/" icon={Plane} onNavigate={() => setOpen(false)}>
              Search flights
            </Tile>
            {user ? (
              <Tile href="/account" icon={Ticket} onNavigate={() => setOpen(false)}>
                Your bookings
              </Tile>
            ) : null}
          </Section>

          {user ? (
            <Section title="Account">
              <Tile
                href="/account/settings"
                icon={UserRound}
                onNavigate={() => setOpen(false)}
              >
                Your details
              </Tile>
              {isStaff ? (
                <Tile href="/admin" icon={ShieldCheck} onNavigate={() => setOpen(false)}>
                  Admin
                </Tile>
              ) : null}
            </Section>
          ) : null}

          <Section title="Help">
            <Tile href="/help" icon={LifeBuoy} onNavigate={() => setOpen(false)}>
              Help centre
            </Tile>
            <Tile
              href="/help/changes-and-refunds"
              icon={RefreshCcw}
              onNavigate={() => setOpen(false)}
            >
              Changes and refunds
            </Tile>
          </Section>

          {user ? (
            <form action={signOut} className="mt-8 border-t border-hairline pt-6">
              <button
                type="submit"
                className="text-sm text-link underline underline-offset-2 hover:no-underline"
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
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: LucideIcon;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-24 flex-col justify-between rounded-card border border-hairline bg-surface p-4 text-sm font-medium text-ink transition-colors hover:border-hairline-strong hover:bg-paper"
    >
      <Icon
        aria-hidden="true"
        size={20}
        strokeWidth={1.75}
        className="text-ink-faint"
      />
      <span>{children}</span>
    </Link>
  );
}


interface Viewer {
  firstName: string | null;
  role: AppRole;
}

/**
 * Who is signed in, read in the browser.
 *
 * This used to come from the root layout, which meant the layout called
 * `cookies()` — and one `cookies()` call anywhere in a render marks the entire
 * route dynamic. A single session lookup in the header was opting every page in
 * the product out of static rendering, which is what forced the route landing
 * pages off ISR and into a per-request Supabase read.
 *
 * Reading it here costs a flash: the header renders signed-out and fills in a
 * moment later. That is a real regression for one element, paid so every page
 * can be cached again. The trade works because the thing that flashes is a
 * greeting rather than anything load-bearing — no content appears or
 * disappears, and nothing here gates access. Authorisation still happens on the
 * server, where it always did; `requireRole` guards /admin regardless of what
 * this hook believes. A tile that should not be there is a wrong link, not an
 * open door.
 *
 * The role comes from `user_roles`, which has a select-own policy, so the anon
 * key reads exactly one row and only the signed-in user's. It is not in
 * `user_metadata` on purpose: metadata is user-writable in Supabase, and a
 * self-assigned `role: admin` would be a privilege escalation.
 *
 * `onAuthStateChange` rather than a one-shot read, so signing out in another
 * tab updates this one instead of leaving a stale name in the header.
 */
function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function load(userId: string | undefined) {
      if (!userId) {
        if (!cancelled) setViewer(null);
        return;
      }

      /* Two reads, both scoped to this user by RLS. Failure of either degrades
         rather than throws: no name is a worse greeting, not a broken header. */
      const [{ data: profile }, { data: roleRow }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (cancelled) return;
      const fullName =
        typeof profile?.full_name === 'string' ? profile.full_name : null;
      setViewer({
        firstName: fullName?.trim().split(/\s+/)[0] ?? null,
        role: ((roleRow?.role as AppRole | undefined) ?? 'customer') as AppRole,
      });
    }

    supabase.auth
      .getUser()
      .then(({ data }) => load(data.user?.id))
      .catch(() => {
        /* Signed out, offline, or Supabase unreachable. The header shows "Sign
           in", which under-claims rather than showing a name to somebody who is
           not signed in. */
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user?.id);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}
