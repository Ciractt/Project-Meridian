# Card brand marks

Drop the official SVG into this folder, named after the brand:

```
public/payment/visa.svg
public/payment/mastercard.svg
public/payment/amex.svg
```

The build picks them up automatically (`npm run manifest` to regenerate without a
full build). Until a file exists, the footer shows a text badge for that brand
instead — deliberately, because a hand-drawn approximation of a card mark is a
trademark problem dressed up as a design decision.

## What's here now

`visa.svg`, `mastercard.svg`, `amex.svg`, `applepay.svg`, `googlepay.svg` — card-shaped
marks from an icon set rather than the networks' own brand assets. Widely used and
fine in practice; if a payment partner ever queries it, the official marks below
are the drop-in replacement, same filenames.

Apple Pay and Google Pay are present but **not rendered** — they sit in
`plannedPayments` in `src/lib/company.ts` until they actually work. Moving one into
`acceptedPayments` is the whole change.

## Where to get the official versions

These are registered trademarks. Use the official assets from each network's own
brand centre — do not pull them off a CDN or an icon pack, and do not redraw them.

| Brand | Source |
| --- | --- |
| Visa | Visa Brand Center — "Visa Brand Mark" downloads |
| Mastercard | Mastercard Brand Center — "Brand mark" downloads |
| American Express | Amex Brand Guidelines / merchant marketing assets |

## Their rules, roughly

Each network publishes guidelines and they are worth two minutes of reading, but
the common requirements are:

- **Don't alter the mark.** No recolouring, stretching, rotating, adding effects or
  putting it inside another shape.
- **Respect clear space.** Usually a defined margin proportional to the mark.
- **Respect the minimum size.** Below it the mark stops being legible and you're
  in breach.
- **Only show brands you actually accept.** This is the one that matters most and
  the easiest to get wrong when copying a competitor's footer.

## What we accept

Card only, through our payment provider — so Visa, Mastercard and American
Express. `acceptedPayments` in `src/lib/company.ts` is the list, and adding PayPal
or Klarna there to look established would be a false claim that loses the sale at
checkout instead of in the footer.
