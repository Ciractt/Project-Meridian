import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Cookie policy' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Cookie policy"
      reviewNotice="Draft. Accurate as of today, and to be re-checked whenever anything is added that sets a cookie."
      intro="Short, because there isn’t much."
    >
      <h2>What we set</h2>
      <p>
        Only cookies needed to make the site work. Today that means session cookies used to
        keep you signed in if you have an account, set by our authentication provider and
        refreshed as you browse.
      </p>

      <h2>What we don’t set</h2>
      <p>
        No advertising cookies, no cross-site tracking, no analytics that profile you across
        other sites. We don’t use your browsing history to choose which promotions to show —
        which is why there’s no consent banner asking permission to do it.
      </p>
      <p>
        If that changes, this page changes first and you’ll be asked before anything
        non-essential is set.
      </p>

      <h2>Managing them</h2>
      <p>
        Your browser can block or clear cookies. Blocking the session cookie means you won’t
        be able to stay signed in, but you can still search and book as a guest.
      </p>
    </ContentPage>
  );
}
