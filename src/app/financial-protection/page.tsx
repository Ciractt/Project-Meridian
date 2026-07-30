import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Financial protection' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Financial protection"
      title="What protection you have, and what you don’t"
      intro="This is the page most travel sites make hard to find."
    >
      <h2>Your flights are not ATOL protected</h2>
      <p>
        Your ticket is issued by the airline the moment you pay. Flights sold that way
        fall outside the ATOL scheme, so no ATOL Certificate is issued and you cannot
        claim from ATOL in relation to a booking made here.
      </p>
      <p>
        If you receive an ATOL Certificate for a booking, it is ATOL protected. If you
        don’t, it isn’t. That test applies to any travel company, not just us.
      </p>

      <h2>An airline’s own protection doesn’t transfer</h2>
      <p>
        Some airlines hold their own ATOL licence or belong to ABTA. Both attach to the
        company you buy from. They cover bookings made directly with that airline and do
        not extend to a booking made through us — protection follows the seller, not the
        flight.
      </p>

      <h2>What that means in practice</h2>
      <ul>
        <li>
          <strong>If the airline stops operating</strong> before you travel, your ticket
          may be worthless. Contact us and your card provider.
        </li>
        <li>
          <strong>Depending on how you paid</strong>, you may be able to claim from your
          card provider. Card scheme chargeback rules and, for some credit card
          purchases, statutory protections may apply. Your card provider can tell you
          what applies to you.
        </li>
        <li>
          <strong>Travel insurance bought separately</strong> may cover airline failure.
          Check the policy — many exclude it unless you add cover for it.
        </li>
      </ul>

      <h2>Why we’re telling you this</h2>
      <p>
        Because a travel company should make clear whether a flight-only booking is
        protected before you book, and because the alternative — letting you assume
        you’re covered — is something you’d only discover at the worst possible moment.
      </p>
      <p>
        <Link href="/terms">Our terms</Link> set this out as well.
      </p>
    </ContentPage>
  );
}
