import Link from 'next/link';
import { requireRole } from '@/features/auth/queries';

/**
 * Privilege gate for everything under /admin.
 *
 * Checked in a layout so it runs for every child route — a per-page check is
 * one forgotten page away from an open door. The check is server-side on every
 * request against the database, so revoking a role takes effect immediately
 * rather than whenever a token happens to expire.
 *
 * Middleware is NOT the gate. It refreshes sessions; it does not authorise.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole('support', '/admin');

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="text-sm font-medium text-chart">
            Internal
          </p>
          <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight">
            Admin
          </h1>
        </div>
        <p className="font-mono text-xs text-ink-faint">
          {user.email} · {user.role}
        </p>
      </div>

      <nav aria-label="Admin sections" className="mb-8 flex gap-4 text-sm">
        <Link href="/admin" className="text-airway underline underline-offset-2">
          Overview
        </Link>
        <Link
          href="/admin/promotions"
          className="text-airway underline underline-offset-2"
        >
          Promotions
        </Link>
        <Link
          href="/admin/content"
          className="text-airway underline underline-offset-2"
        >
          Content
        </Link>
      </nav>

      {children}
    </div>
  );
}
