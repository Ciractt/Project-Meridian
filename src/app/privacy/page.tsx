import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Privacy policy' };

/**
 * Draft, but an accurate one.
 *
 * Written from the actual data model rather than a template — which is the useful
 * part, because a lawyer can review a description of what the system really does
 * far more cheaply than they can work it out from scratch.
 */
export default function Page() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy policy"
      reviewNotice="Draft. This accurately describes what the system does today, but it has not been reviewed by a solicitor and must be before we take real payments."
      intro="What we collect, why, and what we deliberately don’t keep."
    >
      <h2>What we collect when you search</h2>
      <p>
        Search criteria — airports, dates, passenger counts and cabin — and the results we
        get back. We store these against the search, not against you: there is no identifier
        linking a search to a person, and we use them to avoid re-asking airlines the same
        question and to show indicative prices on our home page.
      </p>

      <h2>What we collect when you book</h2>
      <p>Passed to the airline in order to issue your ticket:</p>
      <ul>
        <li>Each traveller’s name, date of birth and the sex shown on their travel document</li>
        <li>Your email address and mobile number</li>
        <li>
          Passport details, but <strong>only where the airline requires them at booking</strong>
        </li>
      </ul>

      <h2>What we keep, and what we don’t</h2>
      <p>
        We <strong>do not store passport or identity document details</strong>. They are
        passed to the airline at the moment of booking and never written to our database —
        there is deliberately no field for them.
      </p>
      <p>
        We <strong>do not store your card details</strong>. They go directly from your
        browser to our payment provider and never reach our servers.
      </p>
      <p>
        What we keep against a booking is: the airline’s reference, the route and dates, the
        number of travellers, the amounts, and the contact email — enough to show you your
        trip and to help you if something goes wrong. Traveller names and dates of birth are
        held by the airline, and we read them from there when needed rather than keeping our
        own copy.
      </p>

      <h2>Accounts</h2>
      <p>
        If you create an account we store your email address and, if you give it, your name.
        You do not need an account to search or to book.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>The airline</strong>, and our flight distribution provider, in order to
          issue tickets
        </li>
        <li>
          <strong>Our payment provider</strong>, to take payment
        </li>
        <li>
          <strong>Our hosting and database providers</strong>, who process data on our
          instructions
        </li>
      </ul>
      <p>
        We do not sell personal data, and we do not use it to decide which promotions to show
        you. Everyone sees the same banner.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Booking records are kept for seven years after travel, for tax and dispute purposes.
        Search records are short-lived — days, not years. Accounts are kept until you ask us
        to delete them.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, ask us to correct it, or ask us to delete it. Ask
        via the contact details in the footer. Some records we may have to keep where the law
        requires it, and we’ll say so rather than quietly ignoring the request.
      </p>
      <p>
        See also <Link href="/cookies">our cookie policy</Link>.
      </p>
    </ContentPage>
  );
}
