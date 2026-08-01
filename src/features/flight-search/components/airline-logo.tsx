/**
 * Airline artwork with a text fallback.
 *
 * A plain <img> rather than next/image on purpose: these are remote SVGs, and
 * putting remote SVGs through the image optimiser needs `dangerouslyAllowSVG`,
 * which widens the XSS surface for no benefit — the files are a couple of
 * kilobytes. Duffel says logo URLs can be null, so the IATA code fallback is a
 * normal path, not an edge case.
 *
 * Sized by a `size` prop rather than a `className` override. That is not
 * stylistic: our `cn()` concatenates without resolving Tailwind conflicts, so
 * passing `className="h-4 max-w-16"` over defaults of `h-6 max-w-24` left BOTH
 * on the element, and CSS picked the winner by stylesheet order rather than
 * attribute order — silently rendering the larger size. A closed set of sizes
 * cannot collide with itself.
 */
const SIZES = {
  sm: { image: 'h-4 w-auto max-w-14 object-contain object-left', text: 'h-4 text-[10px]' },
  /* The cap narrows at `xl`, where the result row puts two legs side by side
     and 96px of wordmark per leg is more than the row can spare. It belongs
     here rather than on the container: the image carries `shrink-0` and its own
     max-width, so narrowing the box around it does not narrow the artwork — it
     just lets a British Airways lockup hang 40px into the departure time,
     which is exactly what happened. */
  md: {
    image: 'h-6 w-auto max-w-24 object-contain object-left xl:h-5 xl:max-w-14',
    text: 'h-6 text-[11px] xl:h-5',
  },
} as const;

export function AirlineLogo({
  src,
  name,
  code,
  size = 'md',
}: {
  src: string | null;
  name: string;
  code: string;
  size?: keyof typeof SIZES;
}) {
  const styles = SIZES[size];

  if (!src) {
    return (
      <span
        aria-label={name}
        className={`flex shrink-0 items-center rounded bg-paper px-1.5 font-mono font-semibold text-ink-muted ${styles.text}`}
      >
        {code || '··'}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={`shrink-0 ${styles.image}`}
    />
  );
}
