import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Changes and refunds' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Changes and refunds"
      intro="What’s possible depends on the fare you bought — which is why we show that before you pay."
    >
      <h2>Check what your fare allows</h2>
      <p>
        Every search result says whether a fare is refundable and what a change costs. The
        same detail is on your booking. Those rules are the airline’s, not ours, and we
        can’t override them.
      </p>

      <h2>Asking for a change or cancellation</h2>
      <p>
        Get in touch with your airline reference. We’ll tell you what the airline will
        allow and what it costs before anything is actioned — you’ll never be committed to
        a change you haven’t seen the price of.
      </p>
      <p>
        You can also deal with the airline directly using your reference, which is often
        faster.
      </p>

      <h2>Refunds are not always cash</h2>
      <p>
        Some airlines refund to a credit or voucher rather than to your card, particularly
        after a cancellation they initiated. “Refunded” and “given a voucher” are not the
        same thing, and we’ll tell you which one you’re being offered before you accept.
      </p>

      <h2>Timing</h2>
      <p>
        Where a refund is due to your card, the airline releases it to us and we pass it
        on. Airline processing is the slow part and can take several weeks. Card
        processing fees on the original payment are not always recoverable, and we’ll be
        clear about the net figure rather than quoting you a gross one.
      </p>

      <h2>If the airline cancels on you</h2>
      <p>
        See <Link href="/passenger-rights">your rights when flying</Link>. We watch for
        airline-initiated changes and contact you when one is detected.
      </p>
    </ContentPage>
  );
}
