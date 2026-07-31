import type { Metadata } from 'next';
import { getCurrentUser } from '@/features/auth/queries';
import { SiteFooter } from '@/components/site-footer';
import { getSiteContent } from '@/features/content/queries';
import { AnnouncementBar } from '@/features/content/components/announcement-bar';
import { NavPanel } from '@/components/nav-panel';
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
  const [user, content] = await Promise.all([getCurrentUser(), getSiteContent()]);
  return (
    <html lang="en-GB" className={cn(display.variable, sans.variable, mono.variable)}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="skip-link focus:left-4 focus:top-4 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        <AnnouncementBar announcement={content.announcement} />

        <header className="border-b border-hairline bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <a href="/" className="font-display text-lg font-extrabold tracking-tight">
              Meridian
            </a>
            <nav aria-label="Account" className="flex items-center gap-3">
              {/* Was `hidden sm:inline`. A product that refuses to hide states
                  everywhere else should not hide "this is not real money" on
                  the device most of the traffic arrives on. */}
              <span className="rounded-full bg-caution-wash px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-caution uppercase">
                Sandbox
              </span>
              {/* Admin and Account moved into the panel. The header was gaining
                  a link every time something was added. */}
              <NavPanel
                user={
                  user
                    ? {
                        firstName: user.fullName?.trim().split(/\s+/)[0] ?? null,
                        role: user.role,
                      }
                    : null
                }
              />
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}
