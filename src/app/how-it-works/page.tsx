import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'How booking works' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="How it works"
      title="What happens between searching and flying"
      intro="No hidden steps, so here they all are."
    >
      <h2>1. You search</h2>
      <p>
        We ask hundreds of airlines at once. That takes a few seconds, and we cache the
        answer briefly so a refresh doesn’t cost another round of enquiries. Every
        price you see already includes taxes, airline charges, our fee and card
        processing.
      </p>

      <h2>2. You pick</h2>
      <p>
        Each result shows the baggage the fare includes, whether it can be refunded or
        changed, the aircraft, the terminals and who is actually operating the flight.
        A cheap fare with no checked bag often isn’t the cheaper option, so we’d rather
        you could see that before choosing.
      </p>

      <h2>3. We re-check the price</h2>
      <p>
        Airline fares move constantly. We re-read the live price when you open the
        booking page, and again immediately before your card is charged. If it has
        moved we stop and tell you, rather than charging a different amount to the one
        you agreed.
      </p>

      <h2>4. You pay, and the ticket is issued</h2>
      <p>
        Card details go straight to our payment provider and never touch our servers.
        The ticket is issued in the same moment, so your airline reference arrives with
        your confirmation and works on the airline’s own website for seats, bags and
        check-in.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        If we take payment and the ticket doesn’t issue, you get a refund in full and we
        tell you so — we never quietly leave a booking in limbo. In the rare case where
        the airline’s answer is unclear we say that too, and ask you not to book again
        while we check, because a second booking would charge you twice.
      </p>
    </ContentPage>
  );
}
