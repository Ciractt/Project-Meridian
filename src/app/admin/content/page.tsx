import { requireRole } from '@/features/auth/queries';
import { getRawSiteContent } from '@/features/content/queries';
import {
  AnnouncementForm,
  HeroForm,
} from '@/features/content/components/content-forms';

export const metadata = { title: 'Content' };

export default async function AdminContentPage() {
  await requireRole('admin', '/admin/content');
  const content = await getRawSiteContent();

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h2 className="mb-1 font-display text-base font-bold tracking-tight">
          Announcement strip
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          A thin line above the header, on every page. Set an end date and it takes
          itself down.
        </p>
        <div className="rounded-card border border-hairline bg-surface p-6">
          <AnnouncementForm initial={content.announcement} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-base font-bold tracking-tight">
          Home page headline
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          The text above the search bar.
        </p>
        <div className="rounded-card border border-hairline bg-surface p-6">
          <HeroForm initial={content.hero} />
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-paper p-6">
        <h2 className="font-display text-base font-bold tracking-tight">
          Not editable, on purpose
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The three claims under the search bar — whole price itemised, ticketed
          straight away, no account needed — are fixed in code. Each one is a
          promise the system actually keeps, and free text there would let someone
          write a claim nothing behind it honours. Changing what we promise should
          mean changing what we do.
        </p>
      </section>
    </div>
  );
}
