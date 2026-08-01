# Architecture decisions

Each entry: what we chose, what we rejected, what it costs us, and how it holds
up as the product grows.

---

## ADR-001 — Search criteria live in the URL, not in client state

**Decision.** `/search?origin=NCL&destination=AGP&departureDate=…` is the single
source of truth. The form validates and then navigates; a Server Component reads
`searchParams` and fetches.

**Alternatives.** Client state + a POST to an API route; a search context
provider; Server Actions returning results.

**Trade-offs.** Slightly more verbose URLs. In exchange: results are shareable
and bookmarkable (people send flight links to whoever they're travelling with —
this is a real conversion path), the back button behaves, the page is
server-renderable for SEO, and we can cache identical searches at the edge. No
search state is duplicated between client and server, which is where most
search UIs rot.

**Scalability.** Filters and sorting in Phase 2 become additional search params,
so filtered result sets stay shareable too.

---

## ADR-002 — Our own domain types, with a supplier adapter

**Decision.** `features/flight-search/types.ts` defines `Place`, `Offer`,
`Itinerary` etc. as *our* shapes. Duffel responses get mapped into them in a
dedicated adapter (`services/duffel/`, Phase 2).

**Alternatives.** Use Duffel's SDK types directly throughout the app.

**Trade-offs.** One extra mapping layer and the discipline to maintain it.

**Scalability.** This is the decision that keeps you from being a Duffel
frontend. Adding a second supplier — a consolidator for long-haul, direct NDC
with a carrier, Amadeus for content Duffel doesn't have — touches one adapter
instead of every component. Given that supplier margin is where an OTA actually
makes money, optionality here is worth real money later.

---

## ADR-003 — Server Components by default; one client boundary

**Decision.** Pages, layouts and data fetching are Server Components. Only
genuinely interactive leaves (`SearchForm`, `PlaceField`, `PassengersField`) are
`'use client'`.

**Alternatives.** Client-side data fetching with TanStack Query.

**Trade-offs.** Interactivity requires deliberate boundary-drawing rather than
sprinkling hooks anywhere.

**Scalability.** Duffel credentials never enter a browser bundle by
construction, not by convention. Result pages ship almost no JavaScript, which
matters because flight search traffic skews mobile and price-sensitive.

---

## ADR-004 — Zod schema shared by client and server

**Decision.** One schema in `features/flight-search/schema.ts`. The client uses
it for instant feedback; the server re-parses the same schema on every request.

**Alternatives.** HTML5 validation only; separate client and server rules.

**Trade-offs.** Zod is ~13kB in the client bundle.

**Scalability.** Search URLs are user-editable and will be crawled, scraped and
fuzzed. Server-side re-validation is not optional, and having one definition
means the two copies cannot drift.

---

## ADR-005 — Hand-rolled combobox, deferred component library

**Decision.** No shadcn/ui or Radix in Phase 1. `PlaceField` implements the
ARIA 1.2 combobox pattern directly.

**Alternatives.** shadcn/ui (adds ~6 dependencies and a design language we'd
immediately override); Headless UI; a third-party autocomplete.

**Trade-offs.** ~180 lines we own and must test.

**Scalability.** Airport selection is the single highest-traffic control in the
product and we need total control of its keyboard and result behaviour. If the
pattern spreads to three or more distinct components, adopt Radix primitives
then — not before.

---

## ADR-006 — Tailwind v4 CSS-first tokens

**Decision.** Design tokens live in `@theme` in `globals.css`. No
`tailwind.config.ts`.

**Alternatives.** Tailwind v3 with a JS config; CSS Modules; vanilla-extract.

**Trade-offs.** Requires Safari 16.4+ / Chrome 111+ / Firefox 128+. Acceptable
for a 2026 consumer travel audience.

**Scalability.** Every token is simultaneously a CSS custom property and a
utility class, so a future dark mode or white-label theme is a variable
override rather than a rewrite.

---

## ADR-007 — `src/` directory (deviation from the brief)

The brief listed `/app`, `/components`, `/features` at the repo root. They're
all there — just nested under `src/`. This keeps thirteen root-level config
files from sitting alongside application code, and matches the current Next.js
default. Say the word and I'll flatten it.

---

## Design direction

**Reference point: aeronautical charts, not travel portals.** The palette is
taken from VFR sectional charts — pale paper, ink linework, and the magenta
that marks controlled airfields. Deliberately not the flat blue that Booking,
Skyscanner, Expedia and Kayak all share, because a new OTA that looks like a
cheaper version of an existing one inherits the comparison.

- **Type.** Bricolage Grotesque for display (restrained: headlines only), Inter
  Tight for body and controls, IBM Plex Mono with tabular figures for anything
  a traveller reads as *data* — IATA codes, times, durations, prices.
- **Signature.** The route line: a hairline path with one marker per stop. It
  appears in the hero, completes itself in the form when both airports are
  chosen, and will head every flight card. The markers encode stop count, which
  is the most important non-price attribute of an itinerary — structure
  carrying information, not decoration.
- **Colour is functional, not decorative.** Sectional charts aren't black and
  white — they use tinted terrain and airspace bands. Each wash in the palette
  carries exactly one meaning and is used for nothing else: airway blue for
  informational content and links, magenta for price and the primary action,
  green for fare drops and confirmations, amber for caution states (long
  layovers, overnight connections, sandbox mode). A traveller learns the code
  once and it holds across every screen.
- **Restraint.** Magenta becomes a solid fill in exactly one place — the search
  button — and takes prices in Phase 2. Blue is never a call to action.

---

## ADR-008 — Raw `fetch` over the official Duffel SDK (revisit at Phase 3)

**Decision.** A ~100-line typed client in `services/duffel/client.ts` instead
of `@duffel/api`.

**Alternatives.** The official SDK, which the brief nominated.

**Trade-offs.** We hand-maintain types for the four endpoints we consume, and
we lose the SDK's servicing helpers.

**Why.** The SDK ships its own HTTP client, which bypasses Next.js's extended
`fetch` and with it the caching, revalidation and request deduplication we need
to keep the search-to-book ratio — and therefore the excess-search bill —
under control. That's a direct cost lever, not a preference.

**Revisit.** Adopt the SDK for order creation in Phase 3, where an officially
maintained client earns its keep and caching is irrelevant. Mixing the two is
fine; the boundary is already drawn.

---

## ADR-009 — Two-call search: create request, then list offers

**Decision.** `POST /air/offer_requests?return_offers=false`, then
`GET /air/offers?offer_request_id=…&sort=…`.

**Alternatives.** `return_offers=true`, which returns everything in one payload.

**Trade-offs.** An extra round trip.

**Why.** Duffel's guidance is to use the List Offers endpoint when you want
pagination, sorting or filtering — which a results page always does. The
alternative means sorting hundreds of offers in application code and shipping
them all to the client. Sorting is a URL param, so sorted results stay
shareable (ADR-001).

---

## ADR-010 — Search returns a discriminated result, not exceptions

**Decision.** `runSearch` returns
`ok | empty | unconfigured | unavailable | rejected`.

**Why.** "No flights on this route" is a normal outcome, not an exception, and
each branch deserves a different, more useful thing to say. Throwing collapses
five distinct situations into one error boundary that can only apologise.

---

## Known limitation: results are not progressive

Duffel's standard offer-request flow waits for airline searches to complete
within `supplier_timeout` (we set 18s, under our own 30s abort) and returns
once. Suspense gets the route header and skeleton to the browser immediately,
but the offers themselves land in a single batch.

Genuinely progressive results would need the multi-step partial-offer flow,
which Duffel marks as experimental and deprecates the v1 endpoint for. Not
worth the complexity yet. Revisit if search feels slow with real content.

## Not done yet, in priority order

1. **Cross-request search caching.** The single biggest cost lever, given the
   1,500:1 search-to-book ratio. Needs a shared store (Supabase or Redis)
   keyed on criteria with a short TTL. `/api/places` is already cached for a
   day; search is not cached at all.
2. **Re-pricing before checkout.** `getOffer` exists and is unused. Nothing may
   take payment without calling it first.
3. **Filters and sorting UI.** Sorting works via `?sort=`; there's no control
   bound to it yet.
4. **Flight detail view.** Cards are terminal — there's nothing to click into.
5. **Rate limiting and bot filtering** on `/search` and `/api/places`.

---

## ADR-011 — Adopt the conventional OTA search-bar pattern

**Decision.** The home page is now a dark hero panel containing a single
connected search bar: From · swap · To · Dates · Travellers · Search. The
headline sits above it at supporting size.

**What this replaced.** A large typographic hero with the form below it. That
version made the headline the focal point and left the form sprawling across
two sparse columns, with the fields half-clipped by the band above.

**Why.** Skyscanner, Booking, Expedia and Kayak all converged on this layout,
and not out of imitation. The whole query is visible in one glance, every
segment is a large target, the primary action never moves, and travellers
arrive already knowing how to use it. Rearranging controls people have learned
is a cost with no matching benefit.

**Where identity still lives.** The type, the palette, the mono treatment of
codes and times, the route line on every result, and the calendar. Distinctive
detail inside a familiar frame — not a familiar detail inside a strange frame.

---

## ADR-012 — Custom two-month range picker over `<input type="date">`

**Decision.** `date-range-field.tsx` plus `components/ui/calendar.tsx`.

**Alternatives.** Native date inputs (what we shipped first); react-day-picker.

**Trade-offs.** ~300 lines to own and keep accessible.

**Why.** Native inputs take one date at a time, render differently in every
browser, and show no surrounding context. Choosing flights is a comparison
task — people want to see the weekend either side and the whole trip shape at
once — so two months have to be visible and the range has to be one gesture.
react-day-picker would do it, but this is the second-most-used control in the
product after airport selection and we want the same control over it (ADR-005).

**Accessibility.** Real `<table role="grid">`, roving tabindex so the calendar
is one tab stop, arrows by day, PageUp/PageDown by month, Escape returns focus
to the trigger, and every cell labelled with its full date.

**Date correctness.** All arithmetic in `lib/date.ts` works on `YYYY-MM-DD`
strings in UTC. Departure dates are calendar dates, not instants — local
`Date` objects are how pickers end up a day out for anyone west of Greenwich.

---

## ADR-013 — Filtering and sorting happen in memory, not in the URL

**Decision.** The server fetches offers once per search. `ResultsPanel` (a
Client Component) owns filter and sort state and does faceting, filtering and
ranking synchronously in memory.

**Alternatives.** Filters as URL params with server-side filtering — which is
what ADR-001 does for search criteria, and what a first draft of this page did.

**Why not that.** Every filter change would be another navigation, and every
navigation re-runs `runSearch`, which is another Duffel offer request. A
traveller ticking four boxes would cost four searches and produce no extra
bookings — straight into the excess-search fee. Skyscanner and Google Flights
keep filters in client state for the same reason.

**Trade-offs.** Filtered views are not shareable, and the offer list is
serialised to the browser. Accepted: the shareable unit is the *search*, which
still lives in the URL.

**Migration path.** Once there's a shared search cache, filters can move into
the URL without extra API calls, and this becomes a server concern again. The
filter functions in `filters.ts` are already pure and environment-agnostic, so
that move is a wiring change.

**Ranking disclosure.** "Best" is 60% normalised price, 40% normalised journey
time. It is documented in `rankBest`, explained on the results page, and
influenced by nothing a supplier pays us. If that ever changes, the disclosure
has to change with it — undisclosed paid ranking on a price comparison is a
regulatory problem, not a product decision.

---

## ADR-014 — Roles live in their own table with no write policy

**Decision.** `profiles` holds user-editable details. `user_roles` holds
privilege and has RLS with a select-own policy and **no insert, update or
delete policy at all**.

**Alternatives.** A `role` column on `profiles`; a custom JWT claim.

**Why.** A single table with a `role` column and an "update your own row"
policy is a privilege-escalation bug with extra steps — the client holds the
anon key and can PATCH its own role to `admin`. With no write policy, neither
the anon nor the authenticated key can grant privilege even with full control
of the browser. Roles are assigned by the service role or by hand in SQL.

**Why not a JWT claim.** Claims are only as fresh as the token. Revoking an
admin wouldn't take effect until it expired. `requireRole` reads the database
on every request, so revocation is immediate.

---

## ADR-015 — Auth foundation now, account features later

**Decision.** Sessions, roles, RLS, the privilege gate and sign-in/sign-up are
built. Saved searches, price alerts and booking history are not.

**Why now.** Retrofitting `user_id` foreign keys and RLS policies onto tables
that already hold data is genuinely painful, and there are no tables yet — so
this is the cheapest this work will ever be.

**Why not the features.** Booking history needs orders. Price alerts need a
scheduler and an email provider. Saved searches without either is a bookmark
with extra steps. The account page says so plainly rather than showing empty
widgets.

**Known cost.** Reading the user in the root layout made `/` dynamic instead of
static. If the home page's TTFB starts to matter, move the account nav into a
small Client Component that fetches its own state, and `/` goes back to being
prerendered.

---

## ADR-016 — Search cache in Postgres, keyed on criteria, short TTL

**Decision.** `search_cache` in Supabase. `runSearch` reads it before calling
Duffel and writes on a miss. Key is a SHA-256 of the canonical criteria plus a
schema version. TTL is the shorter of ten minutes and the earliest offer expiry
less a two-minute margin.

**Alternatives.** Next.js data cache (`unstable_cache` / `use cache`); Redis or
Upstash; an in-process Map.

**Why Postgres.** The in-process Map is wrong outright — serverless invocations
don't share memory, so it would be a cache that mostly misses. Next's data cache
would work, but the hit rate would be invisible, the rows uninspectable, and dev
behaviour different from production. Redis would be faster and is the right
answer at volume, but it's another service to run and pay for when the database
is already there and the read is a single indexed primary-key lookup.

**Why it matters more than it looks.** Duffel bills per offer request above a
search-to-book allowance, and consumer flight search browses far more than it
books. This is the difference between a search bill that scales with bookings
and one that scales with traffic. It is the highest-leverage cost decision in
the codebase.

**Bonus.** The table doubles as the search log the admin screens read, so
"busiest routes" and the cache hit rate came free rather than needing separate
analytics.

**Correctness constraints, in priority order.**

1. *Never outlive the offers.* A cached row whose offer IDs have expired sends
   travellers to a checkout that fails. Hence the TTL cap and margin; if that
   leaves nothing useful, we don't cache at all.
2. *Never cache empty results.* A route with no availability now may have some
   in an hour. Caching nothing for ten minutes makes the site look broken to
   save one request.
3. *Never fail a search because the cache failed.* Every read and write path
   logs and continues.
4. *Every field that changes the Duffel request is in the key.* Cabin and
   passenger mix change pricing; `direct` changes `max_connections`. Currency,
   loyalty or corporate fares would need adding — and those make fares
   user-specific, at which point a shared cache stops being valid at all.

**Trade-offs.** Prices can be up to ten minutes stale, so the results page says
so and the re-price step before payment becomes mandatory rather than merely
advisable.

**Known gap: no stampede protection.** Fifty simultaneous requests for a cold
key all call Duffel. The fix is a Postgres advisory lock around the miss path,
and it isn't worth the complexity until there's traffic that warrants it.

---

## ADR-017 — Service-role access is confined to two modules

**Decision.** The secret key is reachable only through
`lib/supabase/service.ts`, which is `import 'server-only'` and returns `null`
when unconfigured. Only `features/flight-search/cache.ts` and
`features/admin/queries.ts` use it.

**Why.** The key bypasses row-level security entirely, so the meaningful control
is how few places can reach it. `server-only` makes importing it from a Client
Component a build error rather than a leak. Returning `null` rather than
throwing means the app runs before the key is configured — the cache degrades to
always-miss and the admin screen says what's missing.

**Follow-up.** `supabase gen types typescript` would remove the remaining casts
in the data layer. Worth doing once the schema settles rather than regenerating
on every migration.

---

## ADR-018 — Duffel is the system of record for orders

**Decision.** `public.orders` stores an index: Duffel order ID, booking
reference, route summary, totals, contact email, status. Full order detail is
fetched live from Duffel when a booking is opened. **Identity documents are
never persisted** — there is deliberately no column for them.

**Alternatives.** Mirroring the full order locally; storing passenger records
including passport data.

**Why.** Two reasons, the second larger than the first.

*Correctness.* Orders change after booking — schedule changes, airline
cancellations, seat assignments, involuntary reroutes. A local copy is stale the
moment it is written, and reconciling it is work with no upside.

*Data protection.* Passenger records are personal data and passport numbers are
about as sensitive as it gets. GDPR data minimisation means holding the least we
can for the shortest time we can. Passing identity documents straight through to
Duffel means a breach of our database exposes names, routes and emails rather
than travel documents. The `purge_after` column exists so the retention policy
is written next to the data rather than in a wiki nobody reads.

**Trade-off.** Opening a booking costs a Duffel API call. Acceptable: people
look at a booking a handful of times, not continuously.

---

## ADR-019 — Booking is idempotent by construction

**Decision.** The client generates a UUID per checkout mount and sends it with
the submission. The server inserts it into `booking_attempts` — whose primary
key is that token — **before** calling Duffel. A second submission with the same
token cannot create a second order.

**Why.** Creating the same order twice means two tickets and a refund argument
with an airline. A double-clicked button, a retried serverless invocation or an
impatient refresh all cause it, and all are ordinary.

**Ordering matters.** The claim happens before the supplier call, not after. A
check-then-act with the write afterwards has a race window exactly where the
expensive operation lives.

**Unresolved hazard.** If `createOrder` times out, the airline may have ticketed
anyway — we would have an order we don't know about. That attempt must be marked
for reconciliation against Duffel's order list, never blindly retried. The
60-second timeout and the comment in `services/duffel/orders.ts` are there
because a retry in that state is how you sell two tickets to one person.

---

## ADR-020 — Re-pricing is mandatory and happens twice

**Decision.** `repriceOffer` runs on load of `/book/[offerId]` and again inside
`attemptBooking` before any payment.

**Why twice.** The first call means the traveller never enters details against a
stale figure — our own cache can serve a price up to ten minutes old (ADR-016).
The second means the price cannot move during the minutes someone spends typing
passenger names. If it does, the booking stops and asks again. We never charge
an amount other than the one displayed.

**Note on trust.** The amount the client sends is used only to decide whether to
say "the price changed". The figure we would charge is always the one Duffel just
returned, so tampering with it cannot alter what is charged.

---

## Payment: still undecided, and now blocking

Everything up to payment is built. `attemptBooking` returns
`payment_not_configured` rather than simulating success — it will never report a
booking that did not happen.

The two paths, and what actually differs:

**Duffel Payments (payment intents → balance).** Duffel collects the card,
handles 3DS/SCA, and deposits net of fees into your Duffel balance; the order is
then paid from balance. You are merchant of record: you hold customer money
briefly, you carry chargeback risk, and this is the fact pattern that makes the
UK ATOL question live. Fastest to ship, and 3DS is handled for you.

**Duffel Cards (pass-through).** The customer's tokenised card pays the airline
directly. You never hold their money, which materially reduces chargeback and
insolvency exposure — but your markup then has to be charged separately, which
is commercially awkward and not supported by every airline.

Both need `createThreeDSecureSession` and Duffel's `DuffelCardForm`, so the
front end is largely shared. The difference is regulatory and commercial, which
is why it is not a decision to make inside a request body.

Recommendation: **Duffel Payments**, on the grounds that 3DS/SCA compliance is
genuinely hard to get right and the pass-through model's separate-markup problem
is worse than the chargeback exposure at this stage. But get the ATOL answer in
writing first — it bears directly on whether holding customer money is something
you want to be doing at all.

---

## ADR-021 — Duffel Payments, and the four amounts that must not be confused

**Decision.** Payment intents → balance → order. The customer's card is charged
by Duffel, funds land in our balance net of fees, and the order is paid from
balance.

**Amounts in play:**

| | |
|---|---|
| `fare` | What the airline charges. Paid from balance. |
| `charge` | What the card is charged. |
| `net` | What reaches the balance: `charge` less Duffel's fee. |
| `margin` | Ours. |

The binding constraint is `net >= fare`. Hence:

```
charge = (fare + margin) / (1 - feeRate)
```

Dividing, not multiplying. Adding 1.4% to a total does not recover a 1.4% fee
taken *from* that total — a mistake that loses a little on every booking and is
invisible until you reconcile.

**Fee rate is assumed, not known.** Duffel's rate depends on where the card was
issued, which we only learn *after* the charge amount is fixed. We gross up at
the higher (non-European) rate, so European cards yield slightly more margin
rather than non-European cards yielding a loss. That is the right way round to be
wrong. `BOOKING_MARGIN_RATE` and `BOOKING_ASSUMED_FEE_RATE` are configurable;
confirm the real rates against your own Duffel pricing.

---

## ADR-022 — The client can never assert that payment happened

**Decision.** `<DuffelPayments onSuccessfulPayment>` takes no arguments and is
treated purely as a hint that the traveller finished the form. `completeBooking`
independently reads and confirms the payment intent server-side before creating
any order.

**Why this is not paranoia.** The callback fires in a browser. If it were
trusted, a crafted request would produce a ticket with no payment. The component
literally cannot give us proof — its signature is `() => void` — so the design
has to establish payment some other way, and does.

**Money-relevant facts are read from our database, not the request.** The offer
ID and payment intent ID are written to `booking_attempts` during
`startBooking` and read back from there in `completeBooking`. Without that
binding, a caller could pay for a cheap offer and then ask us to book an
expensive one.

---

## ADR-023 — Every post-payment failure has a defined compensation

Once the payment intent is confirmed, the money is ours and no failure may leave
a traveller paid-and-ticketless in silence.

| Failure | Response | Why |
|---|---|---|
| Offer expired between payment and ticketing | Refund in full | We can no longer supply what was paid for. |
| Fare rose above what we collected | Refund in full | Booking would sell below cost. |
| Airline definitively declined | Refund in full | No ticket will exist. |
| `createOrder` **timed out** | `needs_reconciliation`, **no refund**, no retry | A ticket may exist. Refunding gives away a ticket we paid for; retrying sells two. |
| Ticket issued, our DB insert failed | Report success, flag for reconciliation | The ticket is valid. Never refund a valid ticket over a bookkeeping error. |
| Refund itself failed | `paid_not_ticketed` | Surfaced to admin as needing a human. |

The distinction between a timeout and a rejection is the important one, and it is
the difference between a bad day and a fraud complaint. A timeout is *absence of
information*, not evidence of failure.

`paid_not_ticketed` and `needs_reconciliation` both appear at the top of the
admin dashboard in a red-bordered block, because both mean someone has paid and
does not know what they have.

---

## What still needs building before this can take real money

1. **The reconciliation job.** Right now clearing the attention queue means
   opening Duffel's dashboard by hand. It needs to list Duffel orders by
   `metadata.attempt_token` and resolve each stuck attempt automatically.
2. **Confirmation email.** The success screen is the only confirmation a
   traveller currently gets. Needs an email provider.
3. **Terms of service and privacy policy.** Not optional — you are taking money
   and processing passenger data.
4. **The ATOL answer, in writing.** This architecture has you holding customer
   money, which is precisely the fact pattern that makes the question live.
5. **Live Duffel access, and a funded balance.** Orders are paid from balance;
   an unfunded balance fails at the last step.
6. **Tests.** `pricing.ts` and the compensation paths in `actions.ts` are the
   first things in this codebase that genuinely warrant unit tests, because their
   failure mode is financial rather than cosmetic.

---

## ADR-024 — The checkout countdown is a readout, not a persuasion device

**Decision.** `OfferCountdown` displays the time left on the airline's own
`expires_at`. It hides above fifteen minutes, escalates below five, and blocks
submission below four — the same four-minute constant the server gate uses.

**Why build it at all.** Not for urgency. Because the constraint is real and
hiding it produces the worst possible outcome: a traveller enters card details,
pays, and gets refunded because the fare died while they typed. Showing the
clock turns that into "you'll need to refresh", which costs a sale instead of
costing trust.

**Rules it follows, and why each one matters.**

- *The clock is never extended, reset, or rounded in our favour.* It reads
  Duffel's instant. A timer we control is a timer we are tempted to lie with.
- *It hides when there is plenty of time.* A countdown running from arrival is
  manufactured urgency, which is a dark pattern and something the CMA has acted
  on in travel specifically.
- *Expiry has a real consequence.* At zero the fare genuinely cannot be booked,
  submission is blocked, and we offer the same journey priced now. A timer with
  no consequence is theatre, and travellers learn to ignore it.
- *The copy never implies someone else is taking the seat.* We don't know that,
  so we don't say it. "Airline holds this fare for 4:12" is true; "2 people are
  looking at this flight" would not be.

**One shared constant.** `MIN_OFFER_WINDOW_MS` lives in
`features/booking/constants.ts` and is imported by both the countdown and
`startBooking`. A timer claiming two minutes remain while the server refuses
below four is worse than no timer at all.

**Accessibility.** `role="timer"` with `aria-live="off"`, because a value
announced every second is unusable with a screen reader. Discrete announcements
fire at five minutes, one minute and expiry instead.

**Recovery path.** The "see the current price" link is rebuilt from the offer's
own slices, so a bookmarked or shared booking URL can still recover the search.
Cabin isn't carried on a Duffel offer, so economy is assumed.

---

## ADR-025 — Identity documents are collected only when the offer requires them

**Decision.** `Offer.identityDocumentsRequired` comes from Duffel's
`passenger_identity_documents_required`. Passport fields render only when it is
true, and the requirement is enforced server-side from the offer — never from a
client-supplied flag.

**Why not always ask.** Most short-haul European fares do not need documents at
booking; the airline collects them at check-in. Asking anyway means holding
passport numbers we have no use for, which is data we then have to protect,
disclose in a privacy policy, and lose in a breach. Collecting less is not
laziness — it is the smaller liability.

**Where the data goes.** Straight through to Duffel in `createOrder` and nowhere
else. `actions.ts` is the only file in the codebase that touches a passport
number and it does not store one. There is deliberately no column for it
(ADR-018).

**Consequence to watch.** Long-haul and US-bound fares are more likely to set the
flag, so the checkout form is longer on exactly the routes with the highest
basket value. Worth watching once there is live traffic.

---

## ADR-026 — The confirmation is a URL, not component state

**Decision.** After ticketing, `completeBooking` returns an order ID and the
client navigates to `/booking/[orderId]`. The old inline success panel is gone.

**Why this was a real defect and not a polish item.** The booking reference lived
in React state. A refresh, a closed tab, or a back button destroyed it — and for
a guest who booked without an account, destroyed it permanently. They would have
paid, been ticketed, and had no way to find their PNR. With no confirmation email
yet, that success screen was the *only* copy of it.

**Access model.** The order ID is a v4 UUID, so the URL is a capability:
unguessable, and shareable by whoever holds it. Same model as an emailed receipt
link, and it is what allows a guest to see their reference at all.

The disclosure is bounded on purpose — route, dates, reference, total, and a
masked contact email. No passenger names, no dates of birth, no documents.
Someone holding the link sees a receipt, not a manifest. A full "manage my
booking" flow should require reference plus surname or email before showing more.

---

## Still missing before this takes real money

Unchanged from ADR-021's list except where noted:

1. **Confirmation email.** Now the most urgent item by a distance. The
   confirmation URL exists but nothing sends it to anyone, so a traveller who
   closes the tab still loses their reference. Needs a provider.
2. **The reconciliation job** for stuck attempts.
3. **Tests** over `pricing.ts` and the compensation paths.
4. **Terms of service and privacy policy** — the privacy policy now has to
   describe passport handling, which is easier to write honestly because the
   answer is "passed to the airline, never stored".
5. **The ATOL answer, in writing.**
6. **Live Duffel access and a funded balance.**

Worth adding to the roadmap rather than the blocker list: **ancillaries.** Duffel
sells bags and seats, and they carry better margin than the fare. That is
probably the largest single revenue lever available and it does not exist yet.

---

## ADR-027 — `cn()` now resolves Tailwind conflicts (reversing ADR-006's note)

**Decision.** `lib/cn.ts` wraps `tailwind-merge`.

**What it replaced.** `parts.filter(Boolean).join(' ')`, with a comment saying to
revisit "if we start passing `className` overrides deep through component trees".

**What it cost to leave.** `AirlineLogo` had defaults of `h-6 max-w-24` and the
filter rail passed `h-4 max-w-16`. Plain concatenation left all four on the
element, and CSS resolved the winner by **stylesheet order, not attribute
order** — so the 96px width won over the intended 64px, the logo pushed the row
32px wider than the 16rem rail, and the airline list painted over the results.

Plain concatenation makes "the last class wins" *look* true when it isn't. That
is a bad property for a utility used in every component, and it fails silently
and visually rather than loudly.

A survey turned up a second instance immediately: the search button passes
`h-full` over a `h-11` default and currently renders correctly by luck of
Tailwind's emit order.

**Cost.** ~7kB and one behaviour change in a single file; the signature is
unchanged.

**Limit worth knowing.** twMerge resolves the scales it recognises. Our custom
theme names (`bg-chart`, `rounded-card`) sit outside them and are left alone. So
this is a safety net, not a licence:

> When a component's own sizing or structure is at stake, expose a closed set of
> variant props rather than accepting a `className` override. `AirlineLogo`'s
> `size` prop cannot collide with itself; a `className` always can.

**Also removed.** A dead duplicate `src/components/ui/airline-logo.tsx`, left
behind by the mid-refactor drift found earlier. Nothing imported it, and an
unused second copy of a component is a trap — you edit it, nothing changes, and
you go looking for a rendering bug that isn't there.

---

## ADR-028 — We describe the itinerary; we never advise the traveller

**Decision.** `features/booking/pre-travel.ts` derives guidance from the booking
and states which borders it crosses. It does **not** tell anyone whether they
need a visa, and there is no plan for it to.

**Why not.** Entry requirements are a function of nationality, purpose of travel,
length of stay, residency, and sometimes previous travel history. We hold none of
those, and shouldn't: nationality is more personal data to protect for a question
we'd still answer badly.

The consequence of being wrong is not a bad user experience. It is denied
boarding at the gate, a wasted fare, and a claim against us for having said so.
The asymmetry is severe — a traveller who checks gov.uk because we told them to
loses two minutes; a traveller who trusts a wrong answer loses their holiday.

**What we do instead.** State the countries entered and, separately, those merely
transited — transit visas catch people out precisely because passengers assume
staying airside means staying out of the country. Then point at
`gov.uk/foreign-travel-advice` and, for US itineraries, ESTA.

**Phrasing is load-bearing.** "Many destinations require a passport valid for six
months beyond return" is a description of a general rule. "You need six months on
your passport" is advice about a person. The first is helpful; the second is a
liability we have no reason to take on. Every string in
`pre-travel-panel.tsx` is written to the first pattern.

**If per-nationality answers are wanted later**, that is a licensed data product
— IATA's Timatic, or a commercial API such as Sherpa — with a contract and an
indemnity behind it. It is not something to infer from a country code.

**What is safe to state**, and now is: which countries the trip touches, roughly
when online check-in opens (labelled approximate, because airlines vary), how
long to allow at the airport, and whether *we* still owe the airline passport
details. That last one is derived from a new `documents_provided` boolean on
`orders` — the fact, never the documents.

---

## Open decision: ancillary markup

`DuffelAncillaries` accepts its own `markup` prop for bags, seats and CFAR, with
a rate and a fixed amount per category. We already apply a margin in
`calculateCharge`.

**Applying both would double-count.** Two options, and they are not equivalent:

1. **Let the component mark up.** Bag and seat prices display inclusive of our
   margin, and `calculateCharge` must then apply margin to the fare only.
   Simplest, and the traveller sees one price per bag.
2. **Keep all margin in `calculateCharge`.** The component shows Duffel's raw
   prices and our margin is applied once to the grand total. Cleaner accounting
   and one place to change the rate — but the bag price shown mid-checkout would
   be lower than the amount it adds to the total, which reads as a hidden fee and
   sits badly against the pricing promise.

Recommendation: **option 1**, on the grounds that the number next to a bag must
be the number it costs. Requires splitting `MARGIN_RATE` into a fare margin and
an ancillary margin so they can be tuned separately — bags typically carry more
headroom than fares.

This is a pricing decision, not a wiring one, which is why the ancillaries
integration stops here pending an answer.

---

## ADR-029 — Duffel's ancillaries component, with the markup on their side

**Decision.** `AncillariesStep` wraps `DuffelAncillaries` for bags and seats, with
`markup` set to our extras margin. Checkout is now details → extras → payment.

**Why not build it.** Seat maps are cabins, rows, sections, wings, exit-row
disclosures and per-passenger availability — a great deal of fiddly work for a
screen a traveller sees once, with no differentiation to show for it. Bags alone
would have been worth owning; bundled with seats it isn't.

**The cost, stated plainly.** Vendor types cross our supplier boundary here. The
component takes Duffel's own `Offer` and `SeatMap`, so `getRawOffer` passes the
untouched payload to this one component. That is a bounded exception to ADR-002,
not a retreat from it: every other consumer still reads mapped domain types, and
the exception is one function and one component wide.

**Markup lives on their side, deliberately.** Applying margin in both the
component and `calculateCharge` would double-count. Between the two options:

- *Component marks up* — a bag displays at the price it adds to the total.
- *Server marks up only* — cleaner accounting, but the bag shows at Duffel's raw
  price and then adds more than that, which reads as a hidden fee.

The second is incompatible with the promise on the home page, so the first wins.
The rate comes from `extrasMarginRate()` in one place and is used twice — by the
component for display and by `calculateCharge` for the charge — because those two
numbers disagreeing is a silent margin leak.

**Two margins, not one.** `BOOKING_MARGIN_RATE` (5%) for fares,
`BOOKING_EXTRAS_MARGIN_RATE` (15%) for extras. Ancillary margin is the main lever
on overall take rate and tuning it should not mean touching fare pricing.

---

## ADR-030 — Extras are priced by the server, from the supplier's figures

**Decision.** The browser sends service IDs and quantities. It never sends prices.
`validateSelectedServices` re-fetches the authoritative amounts, rejects anything
it cannot find, and computes the total itself.

**Why it matters.** Duffel's component runs in the page. Without this, a crafted
request could claim a £60 checked bag costs a penny — and the airline would still
take £60 from our balance. Every booking would be a small loss and nothing would
look wrong.

**The trap worth naming.** Baggage prices live in the offer's
`available_services`; **seat prices do not** — they live inside the seat maps. A
validator that walks only the first source silently accepts any seat price it is
handed. `collectSeatPrices` exists for that reason, and the seat maps are fetched
only when a selected ID isn't already accounted for, because widebody maps are
large.

Mixed currencies are rejected rather than summed. A total across currencies isn't
merely wrong, it's meaningless.

**Four amounts now, not three.** `fare`, `extras`, `charge`, `net` — and the
binding constraint is `net >= fare + extras`. The post-payment coverage check
compares against `supplier_amount` on the attempt row, not the fare: checking
against the fare alone would happily ticket a £60 bag we never collected for.
Duffel also requires the order's payment amount to equal the offer total plus
every selected service, so sending the fare alone is rejected outright.

---

## ADR-031 — Promotions carry disclosure by construction

**Decision.** `promotions` is admin-editable and publicly readable. Two of its
columns exist for legal reasons rather than product ones, and both are enforced
in the database as well as the application.

`is_paid_placement` — when true the banner renders an "Ad" label
unconditionally. Advertising must be identifiable as advertising; an unlabelled
paid banner above search results reads as an editorial recommendation, and that
is the practice the ASA and CMA act on rather than the payment itself.

`terms_href` — a headline matching a savings-claim pattern (`20% off`, `save`,
`discount`) is refused without one. "Up to 20% off" with nowhere to check what it
applies to is a misleading practice under the DMCC Act, not merely loose copy.

**Why enforced rather than documented.** The person filling this form is under
commercial pressure to get a banner live, quite possibly for an airline that is
paying. That is exactly the moment a documented convention gets skipped. So the
database carries a `check` constraint, the server action refuses, and the
component renders the label without asking.

**One live banner at a time.** Activating deactivates the rest. A homepage
stacking competing sales looks like a discount site rather than a price
comparison one, and dilutes whichever offer actually matters.

**Placement below the search bar, not above.** Someone arriving wants to type two
airports. Pushing the form down the fold optimises for the airline paying us over
the traveller — which is the same trade the pricing promise refuses elsewhere.

---

## ADR-032 — The footer omits trust signals we don't hold

**Decision.** All company, licence and bonding details come from
`lib/company.ts`, every field starts empty, and the footer renders nothing for a
blank field.

**Why this needed to be a decision.** The obvious way to build a footer modelled
on an incumbent's is to copy its shape complete with an ATOL line and a row of
payment badges, intending to fill them in later. That produces a site claiming
financial protection it does not have and payment methods it cannot take.

The first is a misrepresentation with legal consequences — ATOL numbers are
issued by the CAA and displaying one you weren't issued is not a placeholder
problem. The second loses the sale at the last screen anyway, when the PayPal
button turns out not to exist.

`acceptedPayments` lists card networks only, because Duffel Payments takes cards.
Adding PayPal or Klarna icons to look established would be a false claim.

**What the footer does say**, and can say honestly today: that flights are sold
as agent for the airline, and that fares and baggage rules are the airline's and
are shown before payment. Both true, both useful, neither borrowed.

**Before launch**, `lib/company.ts` needs filling and the ATOL question resolving
— the file says so, next to the fields.

---

## ADR-033 — Destination images are self-hosted, and optional

**Decision.** `FeaturedRoute.image` is a path under `/public`, not a remote URL.
Cards render a chart-style panel with the route codes when no image is set.

**Why self-hosted.** Hotlinked stock images get deleted, moved or rate-limited,
and the failure shows up as holes in the home page. Local files also go through
next/image, so they are format-converted and sized to the layout — a remote URL
would need its host added to `next.config` and would ship whatever dimensions the
source happened to have.

**Why the licence matters more than the credit.** A homepage selling flights is
commercial use however editorial the photograph looks. `attribution` records
source and licence per file even where no visible credit is required: if a file is
ever queried, the answer has to exist somewhere. `public/destinations/README.md`
carries the guidance, including the warning about photographs of people, where a
model release is a separate question from the image licence.

**Why the no-image state is a design, not a placeholder.** Six missing photos
should not look broken. The fallback uses the terrain tint, the chart grid and the
route line — the product's own vocabulary — so the section works today and photos
improve it rather than being load-bearing.

---

## Open question: this section has no prices

Skyscanner's equivalent pairs each photo with a real fare and a price drop. Ours
pairs a photo with "we'll ask for your dates", which makes the photograph
decoration rather than information — it occupies the space where the reason to
click should be.

Two honest ways to close that, and they are not equivalent:

1. **Show a fare from the search cache.** We already store recent searches per
   route, so "from £176" is available for routes people have searched. It must be
   labelled as indicative and dated, because a homepage price that doesn't survive
   to the results page is the drip-pricing failure in reverse — and the cache TTL
   is ten minutes, so most entries would be stale by the time anyone sees them.
2. **Drop the photos and keep a compact link list.** Less inviting, entirely
   honest, and faster.

A third option — running live searches to populate the home page — is the one to
avoid: it would burn the search-to-book ratio on visitors who haven't asked for
anything, which is precisely what ADR-016 exists to prevent.

---

## ADR-034 — Home page prices come from real demand, free

**Decision.** `route_prices` records the cheapest offer from every live search.
The home page reads it for indicative "from" fares.

**Why this way.** The open question in ADR-033 was how to put a number next to a
destination without lying or paying for it. Three options:

1. *Scheduled searches to populate the page.* Costs an offer request per route per
   refresh, spent on visitors who haven't asked for anything — exactly what the
   search cache exists to prevent (ADR-016).
2. *Read the search cache directly.* Ten-minute TTL keyed on exact dates, so
   almost every entry would be expired or irrelevant.
3. *Record cheapest-per-route as a by-product of searches people already make.*
   Zero marginal API cost, self-improving with traffic, and every figure has a
   real search behind it.

**Not a minimum-ever table.** Each observation overwrites the last. An all-time
low that stopped being achievable months ago is the worst possible number to show
— and "prices seen recently" is then literally true rather than technically true.

**The RLS policy carries the freshness rule.** Rows older than seven days simply
aren't selectable. The database decides what counts as current rather than a
`WHERE` clause somebody forgets to write in a second query.

**Displayed with its age.** "from £176 · seen 2 days ago" plus a caveat under the
grid. A homepage price presented as *the* price, that then isn't available, is the
drip-pricing failure inverted — a poor look anywhere and indefensible under a
headline about prices not moving.

**Failure mode is graceful.** No prices means the compact cards render without
them and the copy changes to match. The section works on day one with no data.

---

## ADR-035 — Home page rhythm, and what earns a place on it

**Decision.** Night panel → paper → white → paper, with a claims strip under the
search bar, priced route cards, three reasons, and a native `<details>` FAQ.

**The diagnosis.** Comparing our home page to Skyscanner's, the difference wasn't
photography — it was that **their page is covered in numbers and ours had none.**
£114, £53 drop, £298 struck through. A destination photograph with no price is a
screensaver; the number is what makes it a marketplace. Everything else followed
from fixing that.

The second problem was flatness: one pale background at one type scale, so good
individual components read as a wireframe. Alternating surfaces and varying
heading scale costs nothing and does most of the work.

**The rule applied to every section**: it carries a number or it answers a
question. Nothing is on the page to fill space. That is why there are no
category chips for features we don't have — an "Explore everywhere" tile that
leads nowhere buys a moment of density and costs the trust the rest of the page
is trying to earn.

**On the FAQ.** Native `<details>`/`<summary>`: no JavaScript, keyboard and
screen-reader support for free, and the answers sit in the HTML for search engines
instead of behind a click handler.

Its content deliberately includes the awkward questions — am I booking with you or
the airline, is this ATOL protected, why does your price differ from the airline's
own site. The markup disclosure ("our price includes a service fee, and it is
inside the total from the first result") is unusual and, given the headline
promise, close to obligatory. A FAQ that only answers easy questions reads as
marketing.

---

## ADR-036 — Destination artwork resolves from the code, and the route list follows demand

**Decision.** Images are named by IATA code in `public/destinations/`. A prebuild
script scans the folder and generates a lookup table. Routes carry no image path.
The home page draws its route list from `route_prices` — real search demand — and
falls back to a curated set below three routes.

**What this replaced, and why it was wrong.** The first version had an `image`
field on each of six hand-listed routes. That works for a fixed list and nothing
else, and flights are not a fixed list: the whole point of ADR-034 was that the
routes on display should follow what people search. A per-route image path
guarantees the artwork can never keep up with the content it's attached to.

**So the coupling is inverted.** Content decides the destinations; artwork attaches
itself where it exists. Adding a photograph is dropping a file — no code change, no
config, no deploy-time decision about which routes are featured.

**Absence is a first-class state.** No artwork for a destination gives the compact
card, so the long tail works without anyone sourcing a photograph of Ouagadougou.
Ordering puts photo cards before code cards, because a grid of nine photos and
three code tiles looks unfinished whereas photos-then-codes reads as deliberate.

**Multi-airport cities alias to a city code.** A photograph of London is a
photograph of London whether they land at Heathrow or Stansted. The map is
deliberately short and hand-written rather than pulled from an airport dataset — a
wrong guess here shows someone the wrong city.

**The build warns about uncredited files.** Not fatal, because a missing licence
line shouldn't block a deploy, but loud, because the moment to record where an
image came from is while you still remember.

**What this doesn't solve.** Relevance. A search for "Faro" returns a portrait as
readily as a harbour, whatever the source — Wikidata, a stock API or a paid
library. Something has to look at the results, which is why bulk fetching can seed
this folder but not own it.

---

## ADR-037 — The customer-facing total is computed at the supplier boundary

**Decision.** `mapOffer` runs `calculateCharge` and sets `Offer.totalAmount` to the
all-in figure: airline fare, taxes, our margin and recovered card processing.
Duffel's fare is kept separately as `supplierAmount`, and the difference is exposed
as `feeAmount`.

**What this fixes, and it was a real defect.** Search results previously displayed
Duffel's fare while `startBooking` added our fee at checkout. On a £401.89 fare the
card form asked for £434.59 — a £32.70 increase appearing after passenger details,
underneath a headline reading "The price you see is the price you pay."

That is drip pricing. It is the precise practice the DMCC Act addresses, the thing
the product's positioning is built against, and it was ours.

**Why the boundary and not the component.** Filtering, ranking, the Best/Cheapest/
Fastest strip and the price slider all operated on pre-fee figures, so a "cheapest"
result was cheapest before a fee that varies with fare size. Computing once at the
mapping boundary makes every downstream consumer correct by default rather than by
remembering.

**Why the same function runs twice.** Checkout re-prices through `calculateCharge`
from `supplierAmount`. Both paths use one function and one set of rates, so search
and checkout cannot disagree — and feeding `totalAmount` back in would apply margin
to margin, which is why the field names are deliberately unambiguous.

---

## ADR-038 — The fee is itemised, not merely included

**Decision.** Every result and the review page break the price into airline fare,
taxes and charges, and **Our fee**. The three sum exactly to the total.

**Why go further than the law requires.** Including mandatory fees in the headline
price is the obligation. Naming your own margin is a choice, and no comparison site
makes it — which is exactly why it is worth making when transparency is the
product's differentiator rather than its marketing.

The test of an honest breakdown is that it adds up. If the lines don't reconcile to
the figure at the top, itemising is worse than not bothering.

**Commercially, this will cost some conversions.** A visible fee invites the
thought "I'll book direct". Two things make it defensible: the fee is small
relative to fare variance between suppliers, and a customer who checks direct and
comes back trusts the next price without checking. The claim only pays off if it is
true everywhere, which is why it is on the result card and not just the FAQ.

**If you want it off**, delete the "Our fee" row — the inclusive total is the part
that must stay, since that is the legal floor rather than the positioning.

---

## ADR-039 — Aircraft and flight numbers belong on the result

**Decision.** Each leg on a result card lists its flight numbers and aircraft type.

**Why.** A 787 and a 737 on the same route are not the same product, and a
turboprop is a different proposition again. Most sites put this two clicks deep,
which is a reasonable choice for a site competing on price alone and an odd one for
a site competing on telling you what you're buying.

It costs one line of monospace per leg and no extra API call — the data was already
in the offer and only the review page used it.

---

## ADR-041 — Search is rate limited on cache misses, and fails open

**Decision.** A caller gets a fixed number of live searches per window, counted
in Postgres, charged only when the cache cannot answer. Over the limit, the
results page says so and names the time. If the limiter itself cannot be
reached, the search proceeds.

**Why.** Duffel meters offer requests against a search-to-book ratio, so the
cost of search scales with traffic while revenue scales with bookings. ADR-014's
cache absorbs repeat queries, but nothing absorbs a client issuing endlessly
*distinct* ones — walking a calendar a day at a time, or enumerating airport
pairs. That is a bill with no ceiling and no booking behind it, and it is the
one place in this product where someone else's behaviour can cost us money
directly.

**Counted on cache misses only.** This is the load-bearing decision. A cache hit
costs nothing, so charging for it would penalise the traveller flipping between
two date pairs while doing nothing about the client walking the calendar. The
behaviour we want to allow and the behaviour we want to stop separate almost
exactly on whether the cache can answer, so that is the line. Every unit of
quota corresponds to a request we are about to be billed for.

**Fails open.** If Supabase is unreachable or the function is missing, the
search runs. A limiter that blocks searching when its own storage is down turns
a cost problem into an outage, and what is at risk here is a bill rather than a
booking. The failure is logged rather than swallowed, so it shows up as soon as
error monitoring exists.

**A fixed window, not a token bucket.** A bucket is fairer under sustained load,
and that is not the problem being solved: this stops a scraper rather than
shaping traffic. A counter is one row and one statement, and readable in psql
during an incident. The increment is a `security definer` function rather than a
read-then-write from the application, because two concurrent searches would
otherwise both read the same count and both write count+1 — the limit would leak
by however many requests arrive in parallel, which is the exact shape of the
traffic it exists to stop.

**What it does not do.** The caller is identified by `x-forwarded-for`, which is
client-supplied and forgeable in general, though on Vercel the leftmost entry is
set by the platform. Someone rotating addresses defeats this. That is an
accepted bar for a spend control: the alternatives — mandatory accounts,
captchas, proof of work — all tax every real traveller to stop a determined few,
and "no account needed" is a stated promise on the home page.

**Trade-off accepted.** Shared addresses arrive as one caller, so a household or
an office shares an allowance. The limit is set generously for that reason, and
the failure mode is a message that explains the constraint and names when it
lifts rather than an error. If it turns out to bite real travellers, the
observable is the log line, and the answer is a higher limit rather than a
cleverer key.

**Alternatives.** Limiting by session or account — rejected, guests are the
default path. Limiting in memory — does not work at all on serverless, where
functions share no state and a cold start is a fresh allowance. Serving stale
cached offers instead of throttling — rejected: past the TTL an offer may not be
bookable, and handing someone a price that fails at checkout is worse than
telling them to wait.
