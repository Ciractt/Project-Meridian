# Meridian — working notes

Read this before changing anything. `ARCHITECTURE.md` has the full reasoning for
every decision (ADR-001 to ADR-039); this is the short version plus the things
that are easy to break without noticing.

## What this is

A UK flight OTA. Search and book real flights through Duffel, take card payment
through Duffel Payments, issue tickets instantly. Sandbox today.

**The differentiator is honesty about price and detail.** That is not marketing
positioning to be worked around — several architectural decisions exist only
because of it, and a change that quietly undermines it is a bug even if it works.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 (CSS-first,
no config file) · Supabase (auth + Postgres) · Duffel (flights + payments) ·
Vercel.

## Layout

```
src/
  app/            Routes. Server Components unless marked 'use client'.
  components/     Cross-feature UI. Knows nothing about flights.
  features/       Vertical slices: flight-search, booking, auth, admin,
                  promotions, destinations, webhooks.
  services/duffel/ The ONLY place Duffel-shaped data exists.
  lib/            env, fonts, cn, dates, formatting, supabase clients.
supabase/migrations/  Numbered, run in order.
```

Rule: `components/` may not import from `features/`. Business logic never lives in
a component file. Duffel types stop at `services/duffel/` — everything downstream
uses domain types from `features/flight-search/types.ts`, mapped in `map.ts`.

The one deliberate exception: `DuffelAncillaries` takes Duffel's own types, so
`getRawOffer` passes the untouched payload to that one component (ADR-029).

## Invariants — breaking these costs money or trust

**Never report a booking that didn't happen.** `attemptBooking` returns explicit
states and there is no path that fakes success.

**Absence of information is not negative information.** This has bitten twice.
A `createOrder` timeout is not a failed booking — the airline may have ticketed.
A null `net_amount` is not a shortfall — settlement may just be lagging. Both went
to reconciliation queues, not refunds. When you find yourself treating "unknown" as
"no", stop.

**Claim before you act.** Booking attempts are claimed before Duffel is called.
Webhook events are claimed before handling. Both use unique constraints so a
retry, double-click or redelivery cannot act twice.

**Every post-payment failure has a defined compensation.** See ADR-023 for the
table. The important row: a timeout gets `needs_reconciliation`, never a refund
and never a retry.

**The price in search results is the price charged.** `mapOffer` computes the
all-in figure at the supplier boundary. `Offer.totalAmount` is what the customer
pays; `supplierAmount` is what the airline gets. Feeding `totalAmount` back into
`calculateCharge` applies margin twice.

**The client can never assert that payment happened.** `onSuccessfulPayment` takes
no arguments by design. Money-relevant facts (offer id, payment intent, service
prices) are read from our database, never from the request body.

**Never claim protection we don't have.** No ATOL number, no ABTA badge, no
payment methods we don't take. `lib/company.ts` fields are empty and the footer
omits blanks. An airline's ATOL does not transfer to us.

**Say what we don't know.** Baggage allowance has an `unknown` state distinct from
zero. Entry requirements are never asserted for a person — we name the countries
and point at gov.uk.

## Gotchas

- **`cn()` uses tailwind-merge**, but it only resolves scales it recognises.
  Custom theme names (`bg-chart`, `rounded-card`) are outside them. Prefer variant
  props over `className` overrides for a component's own sizing.
- **Cache schema version** in `features/flight-search/cache.ts` must be bumped
  whenever the `Offer` shape changes, or stale rows deserialise wrong.
- **Duffel local datetimes have no offset** — they're airport-local.
  `formatLocalTime` slices the string, which is correct for those and WRONG for
  instants like `expires_at`. Use `formatInstantTime` for anything with a `Z`.
- **`getOffer` needs `return_available_services=true`** or bags silently vanish.
- **Technical stops** live inside a segment. Use `slice.stopCount`, never
  `segments.length - 1`, or you'll call a one-stop flight direct.
- **Grid items stretch to equal row height.** Bit the FAQ accordion. `items-start`.
- **`prebuild` regenerates asset manifests.** Drop files in `public/destinations/`
  (named by IATA code) or `public/payment/` — no code change needed.

## Workflow

```bash
npm install
npm run dev          # regenerates manifests via prebuild on build only
npm run typecheck
npm run build        # fails on type errors, by design
```

Migrations run in order in the Supabase SQL editor. See `SETUP.md`.

Commit before and after each change. `git diff` is the check that a change did
what was intended — several bugs here compiled cleanly and rendered wrong.

## Operational gaps

Not defects, but each has a cost attached and none is visible from the UI:

- **No rate limiting on search.** Duffel bills for searches beyond the
  search-to-book ratio. The cache mitigates repeat queries; nothing stops a bot
  or a bored person issuing thousands of distinct ones.
- **No error monitoring.** Failures are `console.error` into deployment logs
  nobody reads. For code that moves money that is thin — `src/app/error.tsx` has
  a note about wiring Sentry.
- **Mobile is unverified.** There are ~76 responsive breakpoints in the
  components, but nothing has been checked on a real device, and travel search
  skews heavily mobile.
- **Accessibility is unverified** in the same way — built to the ARIA patterns,
  never tested with assistive technology. The statement at /accessibility says so.

## What to do next

In order, from `DUFFEL-GAP-ANALYSIS.md` and the open items in `ARCHITECTURE.md`:

1. Special assistance requests (gap 3.4). An accessibility obligation as much as
   a feature: today someone needing assistance has to ring the airline.
2. `npm run format` rewrites 69 files on a clean checkout. The
   `prettier-plugin-tailwindcss` config needs `tailwindStylesheet` pointing at
   `globals.css` so it can see the `@theme` tokens; that closes most of it but
   not all. Fix it as its own commit, before it lands on top of a feature diff.

Shipped since this list was last accurate: confirmation emails, the
reconciliation job, tests on `pricing.ts` and the compensation paths, loyalty
accounts, self-service cancellation, post-booking bags, admin queues, editable
site content, route landing pages, the Ulysse-derived visual direction, checkout
account signup, search rate limiting, error monitoring, and the removal of the chart-derived devices (ADR-042, ADR-043).

Before real money: terms and privacy reviewed by a solicitor, `lib/company.ts`
filled in, live Duffel access with a funded balance, and **the ATOL question
answered in writing by Duffel** — who is the principal for UK ATOL purposes when
selling under their accreditations. That one is still open and it gates launch.
