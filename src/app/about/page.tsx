import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Who we are' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="About"
      title="Who we are"
      intro="A flight search built on the idea that you should be able to see what you’re paying for."
    >
      <p>
        Meridian sells flights from hundreds of airlines. We take a fee, we tell you what
        it is, and every price you see already includes it along with taxes, airline
        charges and card processing.
      </p>
      <p>
        That’s the whole proposition. Not the cheapest guaranteed, not the biggest
        selection — the one where the number doesn’t move and the details aren’t buried.
      </p>

      <h2>What we’re deliberately not doing</h2>
      <p>
        No urgency timers we control, no invented scarcity, no personalised pricing, and
        no paid placement in search results. Our <Link href="/pricing-promise">pricing
        promise</Link> sets out what that means in practice, and{' '}
        <Link href="/financial-protection">financial protection</Link> covers the less
        comfortable side — what protection you have with us, and what you don’t.
      </p>

      <h2>Contact</h2>
      <p>
        Details are in the footer. If something on this site is wrong, misleading or
        broken, telling us is genuinely useful.
      </p>
    </ContentPage>
  );
}
