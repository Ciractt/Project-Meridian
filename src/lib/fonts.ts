import { Plus_Jakarta_Sans } from 'next/font/google';

/**
 * One family, everywhere.
 *
 * This began as three faces: a display grotesque, a body sans, and a mono with
 * tabular figures for anything read as data — IATA codes, times, durations,
 * prices. The reference uses one family throughout and lets weight carry the
 * distinction, and having gone that way for the palette it would be odd to keep
 * a second typeface arguing the other case.
 *
 * The alignment argument for mono was real and survives: figures in a column
 * take `tabular-nums`, which Plus Jakarta Sans supports, so a list of prices
 * lines up without a second file to download.
 *
 * `display` and `sans` remain two exports because roughly sixty files import
 * them by name. They resolve to the same family, so the distinction is now
 * weight and tracking at the call site. Collapsing them is a rename and can
 * happen on its own.
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
