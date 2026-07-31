'use client';

import { createContext, useContext, useMemo, useState } from 'react';

/**
 * What the traveller has added, shared between the extras step and everything
 * that displays a total.
 *
 * The price panel is a server component rendered beside the form, the sticky
 * bar lives inside the form, and the extras selection happens in a third place
 * again. Without somewhere shared to put it, the panel kept showing the flight
 * total while the payment step charged flights plus bags — two numbers on one
 * screen, and the smaller one set in the larger type.
 *
 * **This is a display figure, not an authority.** It comes from Duffel's own
 * component metadata, with our markup already applied by Duffel, so it should
 * match — but `startBooking` prices the selection server-side and that result
 * is what the payment intent is created for. If the two ever disagree, the
 * server wins and the payment step shows the difference. Nothing here is
 * allowed to decide what gets charged; it only decides what gets shown before
 * the server has been asked.
 *
 * That is a softening of the line drawn in services.ts, which says the browser
 * must never tell us what things cost. It still must not — SelectedService
 * carries id and quantity and no price, and that has not changed. What has
 * changed is that refusing to *show* a number left a panel claiming £115 while
 * a seat worth £23 sat selected on the same screen, which is a worse failure
 * of the same principle.
 */
interface CheckoutTotals {
  /** Minor units, or null when nothing is selected or the figure is unusable. */
  extrasMinor: number | null;
  extrasCurrency: string | null;
  setExtras: (minor: number | null, currency: string | null) => void;
}

const Context = createContext<CheckoutTotals | null>(null);

export function CheckoutTotalsProvider({ children }: { children: React.ReactNode }) {
  const [extrasMinor, setExtrasMinor] = useState<number | null>(null);
  const [extrasCurrency, setExtrasCurrency] = useState<string | null>(null);

  const value = useMemo<CheckoutTotals>(
    () => ({
      extrasMinor,
      extrasCurrency,
      setExtras: (minor, currency) => {
        setExtrasMinor(minor);
        setExtrasCurrency(currency);
      },
    }),
    [extrasMinor, extrasCurrency],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCheckoutTotals(): CheckoutTotals {
  const value = useContext(Context);
  if (!value) {
    throw new Error('useCheckoutTotals must be used inside CheckoutTotalsProvider');
  }
  return value;
}
