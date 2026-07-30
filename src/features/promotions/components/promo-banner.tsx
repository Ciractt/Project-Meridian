import Link from 'next/link';
import type { Promotion } from '../queries';

/**
 * Homepage promotional banner.
 *
 * The partnership label is not decoration and is not optional. When
 * `isPaidPlacement` is true it renders unconditionally, because advertising has
 * to be identifiable as advertising — an unlabelled paid banner sitting above
 * search results reads as an editorial recommendation, and that is the practice
 * regulators act on rather than the payment itself.
 *
 * Where a partner is named but the placement isn't paid, we still say so. "In
 * partnership with X" is useful context and costs nothing to be honest about.
 *
 * Uses a plain <img> rather than next/image because partner artwork arrives from
 * arbitrary hosts at short notice, and having to redeploy a config change to run
 * a sale is the kind of friction that leads to the label being dropped instead.
 */
export function PromoBanner({ promotion }: { promotion: Promotion }) {
  return (
    <section
      aria-label={promotion.isPaidPlacement ? 'Advertisement' : 'Promotion'}
      /* 1224 × 460 is roughly what the incumbents use, and it works for the same
         reason: at this height the artwork can carry the message and the copy can
         sit out of its way at the bottom. A short banner forces text over the
         middle of the image and both suffer. */
      className={`relative aspect-[1224/460] min-h-64 overflow-hidden rounded-card ${promotion.backgroundClass}`}
    >
      {promotion.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={promotion.imageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}

      {/* Scrim from the bottom, not the side: the copy sits at the foot of the
          banner, so that's the only part that needs darkening. Leaves the middle
          of the artwork alone. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-white text-balance sm:text-3xl">
            {promotion.headline}
          </h2>

          {promotion.subhead ? (
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              {promotion.subhead}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/75">
            {promotion.isPaidPlacement ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono tracking-[0.14em] uppercase">
                Ad
              </span>
            ) : null}
            {promotion.partnerName ? (
              <span>In partnership with {promotion.partnerName}</span>
            ) : null}
            {promotion.termsHref ? (
              <Link
                href={promotion.termsHref}
                className="underline underline-offset-2 hover:no-underline"
              >
                Terms apply
              </Link>
            ) : null}

            {/* Native <details> rather than a modal: no JavaScript, keyboard and
                screen-reader support for free. */}
            <details className="relative">
              <summary
                aria-label="Why you're seeing this"
                className="flex size-4 cursor-pointer list-none items-center justify-center rounded-full border border-white/50 text-[9px] leading-none text-white/80 [&::-webkit-details-marker]:hidden"
              >
                i
              </summary>
              <div className="absolute bottom-6 left-0 z-10 w-72 rounded-card bg-surface p-4 text-xs leading-relaxed text-ink-muted shadow-2xl shadow-ink/30">
                <p className="mb-2 font-display text-sm font-bold tracking-tight text-ink">
                  Why you’re seeing this
                </p>
                {promotion.isPaidPlacement ? (
                  <p>
                    {promotion.partnerName} has paid for this placement. It does not
                    affect how flights are ranked in search results.
                  </p>
                ) : (
                  <p>
                    We’re highlighting this ourselves. Nobody has paid for it.
                  </p>
                )}
                <p className="mt-2">
                  We don’t use your personal data, browsing history or location to
                  choose it — everyone sees the same one.
                </p>
              </div>
            </details>
          </div>
        </div>

        {promotion.ctaLabel && promotion.ctaHref ? (
          <Link
            href={promotion.ctaHref}
            className="shrink-0 rounded-control bg-surface px-6 py-3 text-center text-sm font-medium text-ink transition-colors hover:bg-paper"
          >
            {promotion.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
