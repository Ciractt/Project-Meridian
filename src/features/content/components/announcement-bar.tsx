import Link from 'next/link';
import type { Announcement } from '../queries';

/**
 * Thin strip above the header.
 *
 * Scheduling is enforced on read, so an expired strip disappears without anyone
 * remembering to remove it. That matters more than it sounds: a "Summer sale"
 * banner still up in November is the site misleading people through neglect
 * rather than intent, and the fix is to make forgetting harmless.
 */
export function AnnouncementBar({ announcement }: { announcement: Announcement }) {
  if (!announcement.text) return null;

  return (
    <div
      className={
        announcement.tone === 'caution'
          ? 'bg-caution-wash text-caution'
          : 'bg-night text-white'
      }
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center text-xs">
        <span>{announcement.text}</span>
        {announcement.href ? (
          <Link
            href={announcement.href}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            {announcement.linkLabel || 'Find out more'}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
