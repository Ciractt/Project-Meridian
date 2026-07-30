import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Your rights when flying' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Passenger rights"
      title="Your rights when a flight is delayed or cancelled"
      intro="These rights are against the airline rather than against us — but we’ll help you use them."
    >
      <h2>Where the rights come from</h2>
      <p>
        UK air passenger rights rules can entitle you to rerouting, care while you wait,
        and in some circumstances compensation, when a flight is cancelled or
        significantly delayed. Whether they apply depends on where you’re flying from and
        to, which airline is operating, and the reason for the disruption.
      </p>
      <p>
        The Civil Aviation Authority publishes the authoritative guidance at{' '}
        <a href="https://www.caa.co.uk/passengers/" target="_blank" rel="noopener noreferrer">
          caa.co.uk/passengers
        </a>
        . We point you there rather than paraphrase rules that turn on the details of
        your specific flight.
      </p>

      <h2>The airline is responsible for getting you there</h2>
      <p>
        Your contract of carriage is with the airline. They can act on your booking
        directly using your airline reference, which is often faster than going through
        us — particularly at an airport.
      </p>

      <h2>What we do</h2>
      <ul>
        <li>
          We watch for airline-initiated changes to your booking and contact you when one
          is detected, rather than leaving you to find out at check-in.
        </li>
        <li>
          We’ll help you understand your options and deal with the airline. We can’t
          overrule their decision or pay compensation on their behalf.
        </li>
        <li>
          We show what your fare allows — refundable or not, and what a change costs —
          before you pay, so the answer isn’t a surprise later.
        </li>
      </ul>
    </ContentPage>
  );
}
