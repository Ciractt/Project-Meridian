import Link from 'next/link';

/**
 * Home page FAQ.
 *
 * Native <details>/<summary>: no JavaScript, keyboard and screen-reader support
 * for free, and the answers are in the HTML for search engines rather than behind
 * a click handler. An accordion is one of the few places a framework component is
 * strictly worse than the platform.
 *
 * The content is chosen to answer what a first-time visitor is actually wary
 * about — who they're buying from, what protection they have, why the price might
 * differ from the airline's own site. Answering the awkward ones plainly is the
 * whole point; a FAQ that only covers easy questions reads as marketing.
 */
const QUESTIONS = [
  {
    q: 'Am I booking with you or with the airline?',
    a: (
      <>
        With us. We take the payment and issue the airline’s ticket immediately, so
        your airline reference works on their own website for seats, bags and
        check-in. The flight itself is operated and governed by the airline under
        their fare rules.
      </>
    ),
  },
  {
    q: 'Is my booking ATOL protected?',
    a: (
      <>
        No. Because your ticket is issued the moment you pay, these sales fall
        outside the ATOL scheme and no ATOL Certificate is issued. Where an airline
        holds its own ATOL licence or ABTA membership, that covers bookings made
        directly with them and does not extend to bookings made here.{' '}
        <Link href="/financial-protection" className="text-link underline underline-offset-2">
          What this means for you
        </Link>
      </>
    ),
  },
  {
    q: 'Why might your price differ from the airline’s own site?',
    a: (
      <>
        Because we charge a fee, and we show you what it is. Every result breaks down
        into the airline’s fare, taxes and charges, and our fee — and those three add
        up to the figure at the top. Nothing appears later.
        <br />
        <br />
        Airlines sometimes hold fares back for their own site, and their headline
        price may exclude taxes or card fees that ours already includes. Comparing
        totals rather than headlines is the only fair test, and we would rather you
        did it than not.
      </>
    ),
  },
  {
    q: 'What is your fee, exactly?',
    a: (
      <>
        A percentage of the fare, which covers running this and the card processing
        cost we’re charged. It appears as “Our fee” on every result and on the review
        page before you pay, so you can see it and decide.
        <br />
        <br />
        Most comparison sites take one too. Very few tell you.
      </>
    ),
  },
  {
    q: 'Do you show every airline?',
    a: (
      <>
        No, and we tell you which ones are missing. A few carriers — Jet2 and
        Ryanair among them — don’t make their fares available to us. On routes they
        fly, we say so on the results page and suggest checking direct.
        <br />
        <br />
        Showing you an incomplete list without mentioning it would let you assume
        you’d seen the whole market. That’s the same failure as a hidden fee,
        arriving by omission rather than by design.
      </>
    ),
  },
  {
    q: 'Can I choose seats and add bags?',
    a: (
      <>
        Where the airline sells them, yes — during checkout, before you pay. The
        price shown next to a bag or seat is the amount it adds to your total. The
        baggage already included in your fare is shown on every result, because a
        cheap fare with no checked bag often isn’t the cheaper option.
      </>
    ),
  },
  {
    q: 'What if the airline changes or cancels my flight?',
    a: (
      <>
        The airline is responsible for getting you there, and UK air passenger
        rights may entitle you to rerouting or compensation depending on the
        circumstances. Contact us and we’ll help, but the airline can also act on
        your booking directly using your reference.
      </>
    ),
  },
  {
    q: 'How do I change or cancel a booking?',
    a: (
      <>
        That depends entirely on the fare you bought, which is why we show whether a
        fare is refundable and what a change costs before you pay rather than in the
        small print afterwards. Get in touch with your reference and we’ll tell you
        exactly what your ticket allows.
      </>
    ),
  },
] as const;

export function HomeFaq() {
  return (
    <section aria-labelledby="faq-heading" className="py-16">
      <h2
        id="faq-heading"
        className="font-display text-2xl font-extrabold tracking-tight"
      >
        Questions worth asking
      </h2>
      <p className="mt-2 mb-6 max-w-xl text-sm text-ink-muted">
        Including the ones most travel sites bury.
      </p>

      {/* `items-start` is load-bearing. Grid items in the same row stretch to
          equal height by default, so opening one <details> grew the row and made
          its neighbour appear expanded with no content in it. */}
      <div className="grid items-start gap-x-10 gap-y-0 lg:grid-cols-2">
        {QUESTIONS.map((item) => (
          <details
            key={item.q}
            className="group border-b border-hairline py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-baseline justify-between gap-4 text-sm font-medium text-ink">
              {item.q}
              <span
                aria-hidden="true"
                className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
