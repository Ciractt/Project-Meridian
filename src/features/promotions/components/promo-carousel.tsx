'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PromoBanner } from './promo-banner';
import type { Promotion } from '../queries';

/**
 * Rotating promotions.
 *
 * Accessibility drives most of the decisions here, because auto-advancing content
 * is one of the easiest things to get wrong:
 *
 *  - **A real pause control**, not just pause-on-hover. WCAG 2.2.2 requires a
 *    mechanism to stop anything that moves automatically for more than five
 *    seconds, and hover is not available to keyboard or touch users.
 *  - **No auto-advance at all under `prefers-reduced-motion`.** Someone who has
 *    asked for less movement has asked for this too.
 *  - **Pauses on hover AND focus.** A banner that slides away mid-read, or while
 *    someone is tabbing towards its link, is actively hostile.
 *  - **No `aria-live` on rotation.** Announcing every automatic change would make
 *    the page unusable with a screen reader; the slides are reachable directly
 *    through the controls instead.
 *
 * Each slide keeps its own "Ad" label, partner attribution and disclosure — those
 * travel with the promotion rather than the carousel, so rotation can never
 * separate a paid placement from the fact that it is one.
 */
const INTERVAL_MS = 7000;

export function PromoCarousel({ promotions }: { promotions: Promotion[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const go = useCallback(
    (next: number) => {
      setIndex((next + promotions.length) % promotions.length);
    },
    [promotions.length],
  );

  useEffect(() => {
    if (promotions.length < 2 || paused || reducedMotion) return;
    const timer = setInterval(() => go(index + 1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [index, paused, reducedMotion, promotions.length, go]);

  if (promotions.length === 0) return null;

  const current = promotions[index];
  if (!current) return null;

  // A single promotion needs no controls and no rotation machinery.
  if (promotions.length === 1) return <PromoBanner promotion={current} />;

  return (
    <div
      ref={regionRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="Promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!regionRef.current?.contains(event.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${promotions.length}`}
      >
        <PromoBanner promotion={current} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {promotions.map((promotion, position) => (
            <button
              key={promotion.id}
              type="button"
              onClick={() => go(position)}
              aria-label={`Show promotion ${position + 1} of ${promotions.length}`}
              aria-current={position === index ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all ${
                position === index
                  ? 'w-6 bg-ink'
                  : 'w-1.5 bg-hairline-strong hover:bg-ink-faint'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Explicit pause. Hover isn't a mechanism for keyboard or touch. */}
          {!reducedMotion ? (
            <Control
              onClick={() => setPaused((value) => !value)}
              label={paused ? 'Resume rotation' : 'Pause rotation'}
            >
              {paused ? '▶' : '❚❚'}
            </Control>
          ) : null}
          <Control onClick={() => go(index - 1)} label="Previous promotion">
            ‹
          </Control>
          <Control onClick={() => go(index + 1)} label="Next promotion">
            ›
          </Control>
        </div>
      </div>
    </div>
  );
}

function Control({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-full border border-hairline text-[10px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
