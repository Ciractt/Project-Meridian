import Link from 'next/link';
import { ContentPage } from '@/components/content-page';
import { company } from '@/lib/company';

export const metadata = { title: 'Help' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Help centre"
      intro="Common questions, and how to reach a person."
    >
      <h2>Before you book</h2>
      <ul>
        <li>
          <Link href="/how-it-works">How booking works</Link> — every step between
          searching and flying
        </li>
        <li>
          <Link href="/pricing-promise">Our pricing promise</Link> — what’s in the price
          and what our fee is
        </li>
        <li>
          <Link href="/financial-protection">Financial protection</Link> — what
          protection you have, and what you don’t
        </li>
      </ul>

      <h2>After you book</h2>
      <ul>
        <li>
          <Link href="/help/changes-and-refunds">Changes and refunds</Link>
        </li>
        <li>
          <Link href="/passenger-rights">Your rights when flying</Link>
        </li>
        <li>
          <Link href="/account">Your trips</Link> — if you booked while signed in
        </li>
      </ul>

      <h2>Adding passport details, seats or bags</h2>
      <p>
        Your airline reference works on the airline’s own website, and for most of these
        that’s the fastest route. If the airline needs passport details before check-in,
        your confirmation says so.
      </p>

      <h2>Talk to someone</h2>
      {company.supportEmail ? (
        <p>
          Email <a href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a> with
          your airline reference and we’ll pick it up.
        </p>
      ) : (
        <p>
          Contact details will appear here. Quote your airline reference in any message —
          it’s the fastest way for us to find your booking.
        </p>
      )}
    </ContentPage>
  );
}
