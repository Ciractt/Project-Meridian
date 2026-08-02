import { twMerge } from 'tailwind-merge';

/**
 * Class-name joiner that resolves Tailwind conflicts.
 *
 * This started as a plain `parts.filter(Boolean).join(' ')`, with a comment
 * saying to revisit if we began passing `className` overrides deep through
 * component trees. We did, and it cost us a real bug: `AirlineLogo` merged its
 * default `h-6 max-w-24` with a caller's `h-4 max-w-16`, leaving all four
 * classes on the element. CSS then picked the winner by stylesheet order rather
 * than attribute order and silently rendered the larger size, which overflowed
 * the filter rail into the results.
 *
 * Plain concatenation makes "the last class wins" look true when it isn't. That
 * is a bad property for a utility used everywhere, so the ~7kB is worth it.
 *
 * Note the limit: twMerge resolves the conflicts it recognises. Our custom theme
 * names (`bg-accent`, `rounded-card`) are outside its known scales, so it leaves
 * those alone. Prefer a closed set of variant props over a `className` override
 * when a component's own styling is at stake — see AirlineLogo's `size`.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
