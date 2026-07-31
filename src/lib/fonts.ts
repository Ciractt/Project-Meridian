import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';

/**
 * One family carrying two of the three jobs, plus mono for data.
 *
 * The reference uses a single friendly geometric sans throughout and lets
 * weight do the work that a separate display face was doing here. Plus Jakarta
 * Sans is the closest thing on Google Fonts — same rounded geometric skeleton,
 * a 200–800 range, and it holds up at both 12px in a table and 48px in a hero.
 *
 * `display` and `sans` are still two exports because ~60 files import them by
 * name. They now resolve to the same family, so the distinction is weight and
 * tracking at the call site rather than two typefaces. Collapsing the exports
 * is a rename, not a design change, and can happen later.
 *
 * Mono stays for now. The reference doesn't use one — times, prices and codes
 * are set in the same face — but dropping it is 136 usages across 43 files and
 * it is the single biggest lever on whether this still reads as us, so it wants
 * its own decision rather than arriving inside a colour change.
 *
 * Loaded via next/font so they are self-hosted, preloaded and immune to layout
 * shift. No render-blocking request to a third-party font host at runtime.
 */
export const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

export const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-src',
  display: 'swap',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-src',
  display: 'swap',
});
