import {
  getAttentionAttempts,
  getFailedConfirmations,
  getPendingAirlineChanges,
  getStrandedRefunds,
  getUndeliveredBags,
  getRecentOrders,
  getSearchStats,
  getTopRoutes,
} from '@/features/admin/queries';
import { formatMoney } from '@/lib/format';
import { resendConfirmation } from '@/features/admin/actions';
import {
  ReconcileAllButton,
  ResolveAttemptButton,
} from '@/features/admin/components/reconcile-controls';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Admin' };

/**
 * First real admin screen: where the search bill is going.
 *
 * Duffel charges per offer request beyond a search-to-book allowance, so the
 * cache hit rate is the number that decides whether search costs scale with
 * bookings or with traffic. It belongs on the first screen, not in a report
 * nobody opens.
 */
export default async function AdminPage() {
  const [
    stats,
    routes,
    attention,
    orders,
    airlineChanges,
    failedEmails,
    strandedRefunds,
    undeliveredBags,
  ] = await Promise.all([
    getSearchStats(),
    getTopRoutes(),
    getAttentionAttempts(),
    getRecentOrders(),
    getPendingAirlineChanges(),
    getFailedConfirmations(),
    getStrandedRefunds(),
    getUndeliveredBags(),
  ]);

  if (!stats) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-8">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Stats aren’t available.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Add <code className="tabular-nums">SUPABASE_SECRET_KEY</code> to{' '}
          <code className="tabular-nums">.env.local</code> and run{' '}
          <code className="tabular-nums">0002_search_cache.sql</code>. Until then the
          search cache is bypassed and every search goes to Duffel.
        </p>
      </div>
    );
  }

  const total = stats.cachedSearches + stats.cacheHits;
  const hitRate = total > 0 ? Math.round((stats.cacheHits / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* The worst state in the system: the airline has cancelled AND we still
          hold their money. Above every other queue. */}
      {strandedRefunds.length > 0 ? (
        <section className="rounded-card border-2 border-danger bg-chart-wash p-5">
          <h2 className="font-display text-base font-bold tracking-tight text-danger">
            {strandedRefunds.length} cancelled booking
            {strandedRefunds.length === 1 ? '' : 's'} not refunded
          </h2>
          <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-muted">
            The airline cancelled and returned money to our balance, but refunding
            the traveller’s card failed. Their booking is gone and we are holding
            their money. Refund manually in the Duffel dashboard — this is not
            retried automatically, because a blind retry on a partially succeeded
            refund is its own problem.
          </p>
          <ul className="space-y-2">
            {strandedRefunds.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-danger/20 pt-2 text-sm"
              >
                <span className="tabular-nums">
                  {row.bookingReference ?? row.id.slice(0, 8)} · {row.origin} →{' '}
                  {row.destination}
                </span>
                <span className="tabular-nums text-xs">
                  {row.airlineRefund && row.currency
                    ? formatMoney(row.airlineRefund, row.currency)
                    : '—'}{' '}
                  owed
                </span>
                <span className="max-w-56 truncate text-xs text-ink-muted">
                  {row.contactEmail}
                </span>
                <span className="max-w-64 truncate text-xs text-danger">
                  {row.error ?? 'unknown error'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {undeliveredBags.length > 0 ? (
        <section className="rounded-card border-2 border-danger bg-surface p-5">
          <h2 className="font-display text-base font-bold tracking-tight text-danger">
            {undeliveredBags.length} bag purchase
            {undeliveredBags.length === 1 ? '' : 's'} paid but not delivered
          </h2>
          <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-muted">
            Charged, the airline didn’t add the bag, and the automatic refund also
            failed. Refund manually in the Duffel dashboard.
          </p>
          <ul className="space-y-2">
            {undeliveredBags.map((row) => (
              <li
                key={row.token}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-2 text-sm"
              >
                <span className="tabular-nums text-xs">{row.token}</span>
                <span className="tabular-nums text-xs">
                  {row.chargeAmount && row.currency
                    ? formatMoney(row.chargeAmount, row.currency)
                    : '—'}
                </span>
                <span className="max-w-64 truncate text-xs text-danger">
                  {row.failureReason ?? 'unknown'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Claimed, failed, and nothing will retry. Each is a paying traveller who
          may have no copy of their booking reference at all. */}
      {failedEmails.length > 0 ? (
        <section className="rounded-card border-2 border-danger bg-surface p-5">
          <h2 className="font-display text-base font-bold tracking-tight text-danger">
            {failedEmails.length} confirmation
            {failedEmails.length === 1 ? '' : 's'} didn’t send
          </h2>
          <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-muted">
            The booking is fine — the email isn’t. Sends are at-most-once and never
            retry themselves, so nothing will fix these without you. A guest who
            closed the tab has no other copy of their reference.
          </p>
          <ul className="space-y-2">
            {failedEmails.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-2 text-sm"
              >
                <span className="tabular-nums">
                  {row.bookingReference ?? row.id.slice(0, 8)} · {row.origin} →{' '}
                  {row.destination}
                </span>
                <span className="max-w-56 truncate text-xs text-ink-muted">
                  {row.contactEmail}
                </span>
                <span className="max-w-64 truncate text-xs text-danger">
                  {row.error ?? 'unknown error'}
                </span>
                <form
                  action={async () => {
                    'use server';
                    await resendConfirmation(row.id);
                  }}
                >
                  <Button type="submit" variant="secondary">
                    Resend
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Airlines have moved these flights and the travellers don't know. Above
          even the payment queue: someone who isn't told turns up at the airport. */}
      {airlineChanges.length > 0 ? (
        <section className="rounded-card border-2 border-caution bg-caution-wash p-5">
          <h2 className="font-display text-base font-bold tracking-tight text-caution">
            {airlineChanges.length} flight
            {airlineChanges.length === 1 ? ' has' : 's have'} been changed by the
            airline
          </h2>
          <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-muted">
            Duffel told us; the traveller doesn’t know yet. Check the change options
            in Duffel, then contact them. Accepting on someone’s behalf isn’t ours
            to do.
          </p>
          <ul className="space-y-2">
            {airlineChanges.map((change) => (
              <li
                key={change.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-caution/30 pt-2 text-sm"
              >
                <span className="tabular-nums">
                  {change.bookingReference ?? change.id.slice(0, 8)} · {change.origin} →{' '}
                  {change.destination}
                </span>
                <span className="tabular-nums text-xs">{change.departureDate}</span>
                <span className="max-w-56 truncate text-xs text-ink-muted">
                  {change.contactEmail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Anything here means a traveller has paid and has no clear outcome. */}
      {attention.length > 0 ? (
        <section className="rounded-card border-2 border-danger bg-surface p-5">
          <h2 className="font-display text-base font-bold tracking-tight text-danger">
            {attention.length} booking{attention.length === 1 ? '' : 's'}{' '}
            {attention.length === 1 ? 'needs' : 'need'} attention
          </h2>
          <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-muted">
            Money moved and the outcome is unclear.{' '}
            <strong>Paid, not ticketed</strong> means a refund is owed.{' '}
            <strong>Needs reconciliation</strong> means a ticket may exist — check
            Duffel’s order list by hand and never retry the booking.
          </p>
          <ReconcileAllButton />

          <ul className="space-y-2">
            {attention.map((attempt) => (
              <li
                key={attempt.token}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-2 text-sm"
              >
                <span className="tabular-nums text-xs">
                  {attempt.paymentIntentId ?? attempt.token}
                </span>
                <span
                  className={
                    attempt.status === 'needs_reconciliation'
                      ? 'text-danger'
                      : 'text-caution'
                  }
                >
                  {attempt.status === 'needs_reconciliation'
                    ? 'Needs reconciliation'
                    : 'Paid, not ticketed'}
                  {attempt.failureReason ? ` · ${attempt.failureReason}` : ''}
                </span>
                <span className="tabular-nums text-xs">
                  {attempt.chargeAmount && attempt.chargeCurrency
                    ? formatMoney(attempt.chargeAmount, attempt.chargeCurrency)
                    : '—'}
                </span>
                <ResolveAttemptButton token={attempt.token} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-base font-bold tracking-tight">
          Recent bookings
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-card border border-hairline bg-surface p-6 text-sm text-ink-muted">
            No bookings yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">Most recent bookings</caption>
              <thead>
                <tr className="border-b border-hairline text-left">
                  <Th>Reference</Th>
                  <Th>Route</Th>
                  <Th>Departs</Th>
                  <Th align="right">Total</Th>
                  <Th>Contact</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 tabular-nums">
                      {order.bookingReference ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {order.origin} → {order.destination}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{order.departureDate}</td>
                    <td className="px-4 py-3 text-right tabular-nums tabular-nums">
                      {formatMoney(order.totalAmount, order.totalCurrency)}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 text-ink-muted">
                      {order.contactEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-bold tracking-tight">
          Search cost, last 7 days
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat
            term="Live searches"
            value={stats.cachedSearches.toLocaleString('en-GB')}
            note="Billable offer requests to Duffel"
            tone="chart"
          />
          <Stat
            term="Served from cache"
            value={stats.cacheHits.toLocaleString('en-GB')}
            note={`${hitRate}% of demand cost nothing`}
            tone="positive"
          />
          <Stat
            term="Distinct routes"
            value={stats.distinctRoutes.toLocaleString('en-GB')}
            note="Origin and destination pairs"
            tone="airway"
          />
        </dl>
        <p className="mt-3 max-w-2xl text-xs text-ink-faint">
          Duffel bills per offer request above a search-to-book allowance. Live
          searches are the billable figure; anything the cache absorbs is free.
          Watch this ratio rather than the raw totals.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-bold tracking-tight">
          Busiest routes
        </h2>
        {routes.length === 0 ? (
          <p className="rounded-card border border-hairline bg-surface p-6 text-sm text-ink-muted">
            No searches recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-hairline bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Most searched routes in the last seven days
              </caption>
              <thead>
                <tr className="border-b border-hairline text-left">
                  <Th>Route</Th>
                  <Th align="right">Live searches</Th>
                  <Th align="right">Cache hits</Th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr
                    key={`${route.origin}-${route.destination}`}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {route.origin} → {route.destination}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums tabular-nums">
                      {route.searches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums tabular-nums text-positive">
                      {route.hits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-card border border-hairline bg-surface p-6">
        <h2 className="font-display text-base font-bold tracking-tight">
          Not built yet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Order detail, manual refunds and airline-initiated change handling. The
          reconciliation job that resolves the queue above is the first of those to
          build — right now clearing it means opening Duffel’s dashboard.
        </p>
      </section>
    </div>
  );
}

function Stat({
  term,
  value,
  note,
  tone,
}: {
  term: string;
  value: string;
  note: string;
  tone: 'chart' | 'positive' | 'airway';
}) {
  const styles = {
    chart: 'bg-chart-wash border-chart/15 text-chart',
    positive: 'bg-positive-wash border-positive/15 text-positive',
    airway: 'bg-airway-wash border-airway/15 text-airway',
  }[tone];

  return (
    <div className={`rounded-card border p-5 ${styles}`}>
      <dt className="text-xs font-medium">{term}</dt>
      <dd>
        <span className="mt-2 block tabular-nums text-2xl font-semibold tracking-tight text-ink">
          {value}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">{note}</span>
      </dd>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-xs font-medium text-ink-faint ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}
