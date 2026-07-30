import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/features/auth/queries';
import { SiteFooter } from '@/components/site-footer';
import { display, mono, sans } from '@/lib/fonts';
import { cn } from '@/lib/cn';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Meridian — Flight search without the surprises',
    template: '%s · Meridian',
  },
  description:
    'Search hundreds of airlines at once. Taxes and charges included from the first result.',
  metadataBase: new URL('http://localhost:3000'),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en-GB" className={cn(display.variable, sans.variable, mono.variable)}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="skip-link focus:left-4 focus:top-4 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        <header className="border-b border-hairline bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <a href="/" className="font-display text-lg font-extrabold tracking-tight">
              Meridian
            </a>
            <nav aria-label="Account" className="flex items-center gap-4">
              <span className="hidden rounded-full bg-caution-wash px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-caution uppercase sm:inline">
                Sandbox
              </span>
              {user?.role === 'admin' || user?.role === 'support' ? (
                <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
                  Admin
                </Link>
              ) : null}
              <Link
                href={user ? '/account' : '/sign-in'}
                className="text-sm font-medium text-ink hover:text-chart"
              >
                {user ? 'Account' : 'Sign in'}
              </Link>
            </nav>
          </div>
        </header>

        <main id="main" className="pb-8">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}
