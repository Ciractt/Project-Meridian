'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  COUNTDOWN_URGENT_BELOW_MS,
  COUNTDOWN_VISIBLE_BELOW_MS,
  MIN_OFFER_WINDOW_MS,
} from '../constants';

/**
 * Countdown on the airline's own offer expiry.
 *
 * This is a readout of a real constraint, never a persuasion device. Rules it
 * follows, all deliberate:
 *
 *  - The clock comes from Duffel's `expires_at`. It is never extended, reset or
 *    rounded in our favour.
 *  - It hides entirely when there is plenty of time left. A timer running from
 *    the moment you arrive is manufactured urgency, and manufactured urgency in
 *    travel is something the CMA has taken action over.
 *  - When it runs out, something real happens: the fare genuinely cannot be
 *    booked and we say so. A timer with no consequence is theatre.
 *  - The copy never implies the seat is going to someone else. We do not know
 *    that, so we do not say it.
 *
 * Accessibility: `role="timer"` with `aria-live="off"`, because a value
 * announced every second is unusable with a screen reader. Discrete
 * announcements are made at five minutes, one minute and expiry instead.
 */
export function OfferCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const target = Date.parse(expiresAt);
  const [remaining, setRemaining] = useState(() => target - Date.now());
  const announcedRef = useRef<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    function tick() {
      const left = target - Date.now();
      setRemaining(left);

      // Announce milestones rather than every second.
      const milestone =
        left <= 0 ? 'expired' : left <= 60_000 ? 'one' : left <= 300_000 ? 'five' : null;

      if (milestone && !announcedRef.current.has(milestone)) {
        announcedRef.current.add(milestone);
        setAnnouncement(
          milestone === 'expired'
            ? 'This fare has expired. Refresh to see the current price.'
            : milestone === 'one'
              ? 'Less than one minute left to hold this fare.'
              : 'Five minutes left to hold this fare.',
        );
      }

      if (left <= 0) onExpire?.();
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  if (!Number.isFinite(target)) return null;

  const expired = remaining <= 0;
  const unbookable = remaining < MIN_OFFER_WINDOW_MS;

  // Plenty of time: say nothing. Silence is the honest default.
  if (!unbookable && remaining > COUNTDOWN_VISIBLE_BELOW_MS) {
    return <Announcer text={announcement} />;
  }

  const urgent = remaining <= COUNTDOWN_URGENT_BELOW_MS;

  return (
    <>
      <Announcer text={announcement} />
      <p
        role="timer"
        aria-live="off"
        className={cn(
          'flex items-baseline justify-between gap-2 rounded-control px-3 py-2 text-xs',
          expired || unbookable
            ? 'bg-accent-wash text-danger'
            : urgent
              ? 'bg-caution-wash text-caution'
              : 'bg-paper text-ink-muted',
        )}
      >
        <span>
          {expired
            ? 'This fare has expired'
            : unbookable
              ? 'Not enough time left to book'
              : 'Airline holds this fare for'}
        </span>
        {expired || unbookable ? null : (
          <span className="tabular-nums font-semibold tabular-nums">
            {formatRemaining(remaining)}
          </span>
        )}
      </p>
    </>
  );
}

function Announcer({ text }: { text: string }) {
  return (
    <span aria-live="polite" className="sr-only">
      {text}
    </span>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
