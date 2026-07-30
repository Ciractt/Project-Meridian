import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Our pricing promise' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Pricing"
      title="The price you see is the price you pay"
      intro="Which is only worth saying if we also show you what it’s made of."
    >
      <h2>Every price is a total</h2>
      <p>
        The figure on a search result includes the airline’s fare, taxes and airline
        charges, our fee, and the cost of processing your card. Nothing is added at a
        later screen. If you add a bag or a seat, the price shown next to it is the
        amount it adds to your total.
      </p>

      <h2>We show you our fee</h2>
      <p>
        Every result breaks down into <strong>airline fare</strong>,{' '}
        <strong>taxes and charges</strong> and <strong>our fee</strong>, and those three
        add up to the total. Our fee is a percentage of the fare; it covers running this
        and the card processing we’re charged.
      </p>
      <p>
        Most comparison sites take a fee too. Very few tell you what it is. We think you
        should be able to see it and decide — including deciding to book direct.
      </p>

      <h2>What we don’t do</h2>
      <ul>
        <li>
          No countdown that resets. When we show time remaining it is the airline’s own
          hold on that fare, and when it runs out the fare genuinely cannot be booked.
        </li>
        <li>
          No “3 people are looking at this flight”. We don’t know that, so we don’t say
          it.
        </li>
        <li>
          No paid placement in search results. Airlines can pay for the banner on our
          home page, which is labelled as an advertisement — they cannot pay to rank
          higher.
        </li>
        <li>No personalised pricing. Two people searching the same flight see the same price.</li>
      </ul>

      <h2>We tell you what we can’t show you</h2>
      <p>
        A few airlines don’t make their fares available to us at all. On routes they
        fly, we name them and say they may be cheaper direct — rather than showing
        you an incomplete list and letting you assume it’s the whole market.
      </p>
      <p>
        This costs us bookings. We think the alternative costs more: finding out
        after you’ve paid that there was a fare we never mentioned is the same
        failure as a hidden fee, just arriving by omission.
      </p>

      <h2>How results are ranked</h2>
      <p>
        “Cheapest” is by total price and “Fastest” by journey time. “Best” weighs price
        at 60% and journey time at 40%. None of it is influenced by what a supplier pays
        us, and if that ever changes, this page will say so.
      </p>
    </ContentPage>
  );
}
