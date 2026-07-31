import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { BaggageAllowance, FareConditions } from '../types';

/**
 * What the fare includes, shown next to what it costs.
 *
 * This exists because of the promise on the home page. Displaying £397 as "total
 * price" when the fare carries no checked bag, and only mentioning bags at
 * checkout, is drip pricing — the exact practice the headline claims we don't do.
 * A price is only honest alongside what it buys.
 *
 * `unknown` renders as an explicit "not shown by the airline" rather than being
 * hidden or guessed at. Silence would read as "no bag", which would be a false
 * claim; guessing would be worse.
 */
export function BaggageSummary({
  baggage,
  className,
}: {
  baggage: BaggageAllowance;
  className?: string;
}) {
  const { carryOn, checked } = baggage;

  if (carryOn === 'unknown' && checked === 'unknown') {
    return (
      <p className={cn('text-[11px] text-ink-faint', className)}>
        Baggage allowance not shown by the airline
      </p>
    );
  }

  const parts: string[] = [];
  if (carryOn !== 'unknown' && carryOn > 0) {
    parts.push(`${carryOn} cabin bag${carryOn > 1 ? 's' : ''}`);
  }
  if (checked !== 'unknown' && checked > 0) {
    parts.push(`${checked} checked bag${checked > 1 ? 's' : ''}`);
  }

  const noChecked = checked === 0;

  return (
    <p
      className={cn(
        'text-[11px]',
        noChecked ? 'text-caution' : 'text-positive',
        className,
      )}
    >
      {parts.length > 0 ? parts.join(' · ') : 'No bags included'}
      {noChecked && parts.length > 0 ? ' · no checked bag' : ''}
    </p>
  );
}

export function FareConditionsSummary({
  conditions,
  className,
}: {
  conditions: FareConditions;
  className?: string;
}) {
  const bits: string[] = [];

  if (conditions.refundable === false) bits.push('Non-refundable');
  else if (conditions.refundable === true) bits.push('Refundable');

  if (conditions.changeable === false) {
    bits.push('no changes');
  } else if (conditions.changeable === true) {
    bits.push(
      conditions.changePenalty && conditions.changePenaltyCurrency
        ? `changes ${formatMoney(conditions.changePenalty, conditions.changePenaltyCurrency)}`
        : 'changes allowed',
    );
  }

  if (bits.length === 0) return null;

  return (
    <p className={cn('text-[11px] text-ink-faint', className)}>{bits.join(' · ')}</p>
  );
}

/** The airline's own fare name, e.g. "Economy Basic". */
export function FareBrand({
  name,
  cabin,
  className,
}: {
  name: string | null;
  cabin: string | null;
  className?: string;
}) {
  const label = name ?? cabin;
  if (!label) return null;
  return (
    <p
      className={cn(
        'text-xs font-medium text-ink-muted',
        className,
      )}
    >
      {label}
    </p>
  );
}
