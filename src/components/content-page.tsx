import Link from 'next/link';

/**
 * Shell for prose pages.
 *
 * `max-w-prose` on the body: a measure of 60–75 characters is the readable range,
 * and legal or explanatory text is exactly where people give up if the lines run
 * the width of a monitor.
 */
export function ContentPage({
  eyebrow,
  title,
  intro,
  reviewNotice,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** For pages that are honest drafts rather than published policy. */
  reviewNotice?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/" className="text-airway underline underline-offset-2">
          Home
        </Link>
      </nav>

      {eyebrow ? (
        <p className="text-sm font-medium text-chart">
          {eyebrow}
        </p>
      ) : null}

      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance">
        {title}
      </h1>

      {intro ? (
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-muted">
          {intro}
        </p>
      ) : null}

      {reviewNotice ? (
        <p
          role="note"
          className="mt-6 rounded-card border border-caution/30 bg-caution-wash p-4 text-sm leading-relaxed text-caution"
        >
          {reviewNotice}
        </p>
      ) : null}

      <div className="mt-8 max-w-prose space-y-5 text-sm leading-relaxed text-ink-muted [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink [&_a]:text-airway [&_a]:underline [&_a]:underline-offset-2 [&_li]:mb-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
