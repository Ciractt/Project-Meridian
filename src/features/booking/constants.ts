/**
 * The offer runway.
 *
 * Shared between the server gate in `startBooking` and the countdown the
 * traveller sees, so the UI and the rule cannot drift. A timer that says you
 * have two minutes while the server refuses at four is worse than no timer.
 */

/** Below this, we will not start a payment. Card entry, 3DS and ticketing all
 *  have to fit inside whatever is left. */
export const MIN_OFFER_WINDOW_MS = 4 * 60 * 1000;

/** Above this, showing a countdown is noise rather than information. */
export const COUNTDOWN_VISIBLE_BELOW_MS = 15 * 60 * 1000;

/** When the remaining time turns from informational to worth acting on. */
export const COUNTDOWN_URGENT_BELOW_MS = 5 * 60 * 1000;
