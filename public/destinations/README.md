# Destination images

## How they work

**Drop a file. That's it.**

Name it after the IATA code and put it here:

```
public/destinations/AGP.jpg
public/destinations/FAO.webp
public/destinations/LON.jpg
```

A build step scans this folder and generates the lookup table, so no code changes
and no route configuration. It runs automatically before `npm run dev` and
`npm run build` — but **a dev server already running won't pick up a new file**,
so restart it or run `npm run manifest`. Any route to a destination you have artwork for
becomes a photo card; everything else uses the compact layout. `npm run manifest`
regenerates it without a full build.

This matters because the routes on the home page are **not** a fixed list. They're
drawn from what people actually search (`features/destinations/demand.ts`), so the
set changes on its own — which is why image lookup has to be automatic rather than
configured per route.

### Multi-airport cities

Use the city code — `LON.jpg` covers Heathrow, Gatwick, Stansted, Luton and City.
Lookup tries the airport code first, then the city. The mapping lives in
`src/features/destinations/images.ts` and is deliberately short; add to it if you
need a city it doesn't cover.

### Coverage strategy

You do not need an image for every airport on earth. UK outbound demand
concentrates heavily — 40 or 50 city files will cover the large majority of what
gets searched, and the long tail degrades to a perfectly good compact card. Start
with ten and add as the demand data tells you what people actually want.

## Specification

| | |
| --- | --- |
| Filename | `<IATA>.jpg` — three letters, any supported extension |
| Dimensions | **1200 × 900** (4:3) |
| Format | JPEG, WebP, PNG or AVIF |
| File size | **under 250 KB**, ~150 KB ideal |

Cards are `aspect-[4/3]` with `object-cover`, so 4:3 crops not at all. Anything
else is centre-cropped — fine for landscapes, unkind to a subject near an edge.

1200px is deliberate: the widest a card gets is about 380px, so that covers a 3×
display with room to spare. Larger only inflates the repository — `next/image`
resizes and converts to WebP/AVIF on request, so what's here is a master, not what
visitors download.

## Licensing

Must permit **commercial use**. A home page selling flights is commercial use
however editorial the photograph looks.

| Source | Commercial use | Attribution | Notes |
| --- | --- | --- | --- |
| Unsplash | Yes | Not required | Permissive; don't build a photo service from it |
| Pexels | Yes | Not required | Similar terms |
| Wikimedia Commons | Varies per file | Usually required | Check each image individually |
| Adobe Stock / Getty | Yes, under licence | No | Costs money, comes with an indemnity |

**Download and commit the file. Do not hotlink.** Hotlinked images get deleted,
moved or rate-limited, and the failure shows up as holes in your home page.

Record every file in `credits.json`, keyed by IATA code. The build warns about any
image without an entry. Most of these licences don't require a visible credit — the
record is for you, so that if a file is ever queried the answer exists somewhere.

## Two traps

**Photographs of recognisable people** need a model release for commercial use,
which is separate from the image licence. Unsplash's licence covers the photo, not
the person in it.

**A few landmarks carry their own commercial-use claims** — the Eiffel Tower's
night lighting is the standard example. Rare, but worth a moment's thought on
anything iconic and illuminated.

## If manual sourcing stops scaling

At a few hundred destinations, or if you build per-route landing pages, consider:

- **Wikidata/Wikimedia** — every notable city has a `P18` image property, so this
  is programmatically fetchable. Free, attribution required, quality inconsistent.
  Best used to *seed* this folder in bulk, then prune by eye.
- **A stock API** (Unsplash, Pexels) — note their terms generally require
  hotlinking their CDN and attributing, which conflicts with self-hosting. Read
  before building around one.
- **Paid travel imagery** — costs money, comes with relevance and an indemnity.

What none of them solve is relevance: "Faro" returns a portrait as readily as a
harbour. Whatever the source, something has to look at the results.
