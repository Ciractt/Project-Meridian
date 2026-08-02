# Duffel API gap analysis

What we use, what we don't, and what it costs us. Ordered by consequence, not by
where it sits in the API.

---

> **Status:** items 1.1, 1.2 and 1.4 are now fixed. 1.3 is partially addressed —
> changes are detected and surfaced to admin, but resolving them through the API
> is not built. Section 2's first four items are done. Everything else stands.

## 1. Correctness gaps — these can cost money or strand a customer

### 1.1 A `202 Accepted` from order creation is treated as success

**Severity: high. Fix before live traffic.**

`createOrder` assumes a 2xx response means a confirmed order. Duffel can return
**202 Accepted**, meaning the request was accepted but the order is *not yet
confirmed*. Duffel warn explicitly that a 202 must not simply be retried, because
retrying can create a duplicate booking.

Right now a 202 would flow into `duffelRequest`'s success path, we would write an
`orders` row, and tell the traveller they're booked — against an order that may
still fail. Or the payload may lack a booking reference and we'd show them nothing.

**What's needed:** treat 202 as a distinct state — the `paid_not_ticketed` /
`needs_reconciliation` machinery already exists and is the right destination. Then
resolve via the `order.created` / `order.creation_failed` webhooks rather than
polling, and never retry.

This is the same class of error as the `net_amount` null bug: an uncertain answer
being read as a definite one.

### 1.2 No webhooks at all

**Severity: high for a live business.**

Duffel supports:

| Event | What it means for us |
| --- | --- |
| `order.created` | Resolves a 202. The only reliable way to close 1.1. |
| `order.creation_failed` | A 202 that ultimately failed — refund owed. |
| `payment.created` | Payment landed on a hold order. |
| `order.airline_initiated_change_detected` | The airline changed or cancelled a flight. |

Deliveries are retried for 72 hours with exponential backoff and are signed, so
signature verification is mandatory — an unverified webhook endpoint is an open
door to forged order updates.

**Without the last one, a customer whose flight is cancelled finds out at the
airport.** That is the single largest operational risk in the product as it stands.

### 1.3 Airline-initiated changes are unhandled

`GET /air/airline_initiated_changes` exposes the change, the slices before and
after, and available actions — `accept`, `cancel`, `change`, `update`. Duffel can
accept changes automatically for some airlines and notify for hundreds more.

Nothing in our code knows this endpoint exists. Combined with 1.2, schedule changes
are invisible to us and to the traveller.

### 1.4 Technical stops inside a segment aren't shown

A single segment can include an intermediate stop where the aircraft lands and the
passenger stays aboard. We count stops as `segments.length - 1`, so an itinerary
with a technical stop is displayed as **"Direct"**.

For a site whose headline is about showing what you're buying, calling a
one-stop flight direct is the worst kind of inaccuracy — small, invisible, and
discovered on the day.

---

## 2. Transparency gaps — directly against the positioning

These are all fields already in responses we fetch. Nothing costs an extra call.

| Field | Why it matters |
| --- | --- |
| `origin_terminal` / `destination_terminal` | Terminal changes at LHR or JFK can mean an hour. Currently unshown. |
| `total_emissions_kg` | Every major competitor shows this. Cheap and on-brand. |
| `airline.conditions_of_carriage_url` | Link straight to the actual contract terms. Almost nobody does this. |
| `segment.stops` | See 1.4 — a correctness issue as well as a disclosure one. |
| `supported_passenger_identity_document_types` | We assume passport. Duffel also supports `tax_id`, `known_traveler_number`, `passenger_redress_number`. US-bound travellers with TSA PreCheck or a redress number currently can't supply them. |
| `conditions` detail | We show refundable / changeable / change fee. The full penalty structure is richer. |
| `available_airline_credits` | A customer holding credit from a cancellation can't spend it. |

**Recommended: implement the first four now.** They are pure additions, no schema
change beyond the domain type, and they are precisely the "details" the product
claims to be better at.

---

## 3. Revenue gaps

### 3.1 Leisure private fares

`private_fares` accepts a `fare_type` **per passenger**. These are genuinely
cheaper fares for eligible travellers. We pass none, so we are systematically
showing higher prices than we could for some passengers.

Corporate variants (`corporate_code`, `tour_code`, `tracking_reference`) matter
later if you sell to businesses. The leisure ones matter now.

### 3.2 Loyalty programme accounts — DONE

Passing a frequent-flyer number can yield discounted fares, extra baggage, or free
seat selection — and lets the traveller earn points, which is a common reason
people book direct instead of through an OTA.

Two flows: at offer request, or by `PATCH /air/offers/{id}/passengers/{id}` on an
existing offer. Note that re-fetching is required afterwards because the price can
change. `supported_loyalty_programmes` on the offer tells you which airlines accept
it.

**This is probably the highest-value missing feature.** "We'll credit your Avios"
removes one of the main reasons to bypass you.

### 3.3 Hold orders / pay later

`type: 'hold'` creates an order without immediate payment, paid later. lastminute
advertise "Book Now, Pay Later" prominently. Requires the `payment.created` webhook
and expiry handling.

### 3.4 Post-booking ancillaries and special service requests

Meals, wheelchair assistance and similar can be added after booking. Both a revenue
line and an accessibility obligation — a traveller needing assistance currently has
to go to the airline.

---

## 4. Feature gaps

### 4.1 Multi-city

`slices` is an array. We hard-code one or two. Three-plus-stop itineraries are
impossible to book with us, and they're disproportionately high-value.

### 4.2 Passenger `age` instead of `type`

You may send `age` *or* `type`, not both. With `age`, each airline applies its own
rules — one carrier treats a 14-year-old as an adult, another as a young adult.
Sending `type` makes that judgement for them and can produce a rejected order or a
wrong fare. **Sending `age` is more correct**, and would remove our own age-band
validation guesswork.

### 4.3 Batch offer requests

Search many routes in one call. The obvious foundation for "cheapest month",
"anywhere", or seeding the home page — though note ADR-016: any of those need
careful thought about search-to-book ratio.

### 4.4 Partial offer requests

The two-step flow: choose outbound, then see inbound options priced against it.
This is how Google Flights and Skyscanner behave, and it is a materially better
long-haul experience than pricing whole round trips.

### 4.5 Order changes initiated by the customer — server side built

`/air/order_change_requests` → `/air/order_changes`. Search for alternatives, see
the price difference, confirm.

**Done:** the service layer, quote-and-price, the token table and the money
model (ADR-044). One slice, date only; origin and destination stay as booked.

**Also done:** the reconciliation pass. It is deliberately narrower than the
booking one — see ADR-045. A change that took payment and did not confirm leaves
someone holding a ticket for a flight they believe they are no longer on, and
the automated response to that is to stop and fetch a human rather than guess.

**Also done:** the payment step. `completeOrderChange` settles the airline out
of the balance after the card clears, and deliberately has no refund path — see
ADR-045.

**Still to build:** the interface. Nothing in the product reaches any of this
yet.

### 4.6 Order cancellations with a refund quote

`/air/order_cancellations` returns the expected refund **before** confirming, so
the traveller sees the penalty and the net figure and then decides. Note
`refund_to` can be `airline_credits` rather than cash — which needs saying plainly,
because "refunded" and "given a voucher" are not the same thing.

Self-service cancellation with a quoted refund would be strongly on-brand.

---

## 5. Not yet relevant, but worth knowing

- **Stays** — Duffel sells accommodation. This is the Phase 4 path, and note it
  makes you a package organiser under the Package Travel Regulations.
- **Duffel Links** — hosted checkout. Would have saved the whole payment build;
  worth knowing it exists as a fallback if the bespoke flow becomes a burden.
- **Batch/async patterns** for large-scale search.

---

## Recommended order

1. **202 handling** (1.1) — can sell two tickets.
2. **Webhooks with signature verification** (1.2) — closes 1.1 and 1.3.
3. **Technical stops** (1.4) — we currently mislabel flights as direct.
4. **Terminals, emissions, conditions-of-carriage link** (2) — cheap, on-brand.
5. **Passenger `age`** (4.2) — removes a whole class of rejected orders.
6. **Loyalty accounts** (3.2) — best revenue-to-effort ratio.
7. **Cancellation with refund quote** (4.6) — cuts support load, strongly on-brand.
8. Leisure private fares, order changes, multi-city, partial offers.

Items 1–3 are defects. Everything above 5 is a defect or a correctness improvement
and should land before any new surface area.
