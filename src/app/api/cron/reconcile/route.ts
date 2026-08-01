import { NextResponse } from 'next/server';
import { runReconciliation } from '@/features/booking/reconciliation';
import { runChangeReconciliation } from '@/features/booking/change-reconciliation';

/**
 * Scheduled reconciliation.
 *
 * Point a Vercel cron at this every 15 minutes:
 *
 *   { "crons": [{ "path": "/api/cron/reconcile", "schedule": "*\/15 * * * *" }] }
 *
 * Protected by a shared secret rather than left open: it talks to Duffel and can
 * issue refunds, so an unauthenticated endpoint would be a way to burn API quota
 * at best. Vercel sends the secret as a bearer token in `Authorization`.
 *
 * Safe to run repeatedly and safe to run concurrently with the admin button —
 * every attempt is re-read, anything already resolved is skipped, and nothing is
 * retried against Duffel.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set — refusing to run reconciliation.');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  /* Sequential, not parallel. Both talk to Duffel and the second is the smaller
     job; running them together buys a second or two and doubles the burst
     against an API we are also rate-limiting ourselves against. */
  const reports = await runReconciliation();
  const changeReports = await runChangeReconciliation();

  // Summarised, not itemised: this response ends up in deployment logs, and
  // booking tokens don't belong there.
  const summary = reports.reduce<Record<string, number>>((counts, report) => {
    counts[report.outcome.status] = (counts[report.outcome.status] ?? 0) + 1;
    return counts;
  }, {});

  const changeSummary = changeReports.reduce<Record<string, number>>(
    (counts, report) => {
      counts[report.outcome.status] = (counts[report.outcome.status] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return NextResponse.json({
    examined: reports.length,
    outcomes: summary,
    changesExamined: changeReports.length,
    changeOutcomes: changeSummary,
  });
}
