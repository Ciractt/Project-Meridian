/**
 * Money as integer minor units.
 *
 * "184.50" + "23.00" through floats is how a total ends up displayed as
 * £207.49999999999997. Everything that adds two amounts together goes through
 * here.
 *
 * These are display helpers. Nothing that decides what gets charged uses them
 * — `pricing.ts` owns that, server-side, and its figures are what the payment
 * intent is created for.
 */

/**
 * Returns null rather than guessing when the string is not a plain decimal.
 * A sum that silently drops a line is worse than one that declines to show:
 * the first is wrong, the second is merely incomplete.
 */
export function toMinorUnits(amount: string): number | null {
  if (!/^-?\d+(\.\d{1,2})?$/.test(amount.trim())) return null;
  const value = Math.round(Number(amount) * 100);
  return Number.isFinite(value) ? value : null;
}

export function fromMinorUnits(minor: number): string {
  return (minor / 100).toFixed(2);
}
