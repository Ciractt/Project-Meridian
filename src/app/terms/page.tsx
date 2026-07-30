import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Terms of service' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of service"
      reviewNotice="Draft — NOT yet legally reviewed, and not sufficient to trade on. A travel solicitor needs to review this before real payments are taken. The summary below describes how the service actually works and is intended as the input to that review, not a substitute for it."
      intro="What we do, what the airline does, and where responsibility sits."
    >
      <h2>Who you are contracting with</h2>
      <p>
        You buy the ticket from us; the flight is provided by the airline under their own
        conditions of carriage, which we link to on every booking. Those conditions govern
        the flight itself — baggage, changes, denied boarding, liability.
      </p>

      <h2>Prices</h2>
      <p>
        Prices include the airline’s fare, taxes and charges, our fee and card processing,
        and are itemised before you pay. Fares change constantly; we re-check the live price
        before charging and will not charge an amount other than the one shown to you. See{' '}
        <Link href="/pricing-promise">our pricing promise</Link>.
      </p>

      <h2>Financial protection</h2>
      <p>
        Flights sold here are not ATOL protected and no ATOL Certificate is issued. See{' '}
        <Link href="/financial-protection">financial protection</Link> for what that means.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>
          Names must match the travel document being used. Corrections after ticketing
          usually carry an airline fee.
        </li>
        <li>
          Passports, visas and entry requirements are yours to check. We can tell you which
          countries your itinerary enters; we cannot tell you what you personally need.
        </li>
        <li>Being at the airport in time, and checking in when the airline requires it.</li>
      </ul>

      <h2>Changes, cancellations and refunds</h2>
      <p>
        Governed by the fare you bought. We show those rules before you pay. See{' '}
        <Link href="/help/changes-and-refunds">changes and refunds</Link>.
      </p>

      <h2>If we make a mistake</h2>
      <p>
        If we take payment and no ticket is issued, you get a full refund. If a price is
        displayed in obvious error we may decline the booking rather than honour it, and will
        refund in full — we will not take payment and then quietly cancel.
      </p>

      <h2>Complaints</h2>
      <p>Contact details are in the footer. Quote your airline reference.</p>
    </ContentPage>
  );
}
