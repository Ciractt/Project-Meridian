import { Bricolage_Grotesque, IBM_Plex_Mono, Inter_Tight } from 'next/font/google';

/**
 * Three faces, three jobs.
 *
 * - display: headlines and the route hero only. Used with restraint.
 * - sans:    all body copy, labels and controls.
 * - mono:    IATA codes, times, durations, prices. Anything a traveller reads
 *            as data rather than prose. Tabular figures keep columns aligned.
 *
 * Loaded via next/font so they are self-hosted, preloaded and immune to layout
 * shift. No render-blocking request to a third-party font host at runtime.
 */
export const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

export const sans = Inter_Tight({
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
