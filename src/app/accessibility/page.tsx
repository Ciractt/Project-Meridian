import { ContentPage } from '@/components/content-page';

export const metadata = { title: 'Accessibility' };

export default function Page() {
  return (
    <ContentPage
      eyebrow="Accessibility"
      title="Accessibility statement"
      intro="What we’ve built in, and what we haven’t yet verified."
    >
      <h2>What we’ve done</h2>
      <ul>
        <li>
          Every interactive element is reachable and operable by keyboard. The date
          picker supports arrow keys by day, Page Up and Page Down by month, and Escape
          to close.
        </li>
        <li>
          One visible focus style throughout, never removed. The calendar is a single tab
          stop rather than thirty-one, using a roving tabindex.
        </li>
        <li>
          Airport selection follows the ARIA combobox pattern. The checkout countdown
          announces at meaningful intervals rather than every second, which would make it
          unusable with a screen reader.
        </li>
        <li>
          Semantic markup throughout: real tables for the calendar and data, native
          disclosure elements for accordions, headings in order.
        </li>
        <li>
          Animation is suppressed for anyone with <code>prefers-reduced-motion</code> set.
        </li>
        <li>
          Errors are announced, associated with their field, and say what to do rather
          than only what went wrong.
        </li>
      </ul>

      <h2>What we haven’t verified</h2>
      <p>
        This has not been tested with real assistive technology by people who use it
        daily, and has had no independent audit against WCAG 2.2. Building to the pattern
        is not the same as confirming it works, and we’d rather say so than claim a level
        of conformance we haven’t measured.
      </p>
      <p>
        Gaps we already know about: the seat map is supplied by a third party whose markup
        we don’t control, and we haven’t tested checkout end to end with a screen reader.
      </p>

      <h2>If something doesn’t work</h2>
      <p>
        Please tell us. A description of what you were trying to do and what happened is
        worth more than any audit. We treat access problems as bugs, not feature requests.
      </p>
    </ContentPage>
  );
}
