/**
 * Company and legal details for the footer.
 *
 * Every field is empty by default and the footer omits anything blank. That is
 * deliberate: a footer full of trust signals you don't hold is the fastest way
 * to destroy the trust the rest of the design is trying to earn — and in the case
 * of ATOL, displaying a licence number you don't have is a misrepresentation
 * with legal consequences, not a placeholder to tidy up later.
 *
 * Fill these in before taking real money. Leave them empty until then.
 */
interface Company {
  legalName: string;
  companyNumber: string;
  registeredAddress: string;
  vatNumber: string;
  supportEmail: string;
  supportPhone: string;
  atolNumber: string;
  bondingNumber: string;
}

/* Typed as `string`, not inferred as empty-string literals — otherwise
   TypeScript narrows every truthiness check to `never` and the footer can't
   compile against fields that are currently blank but won't always be. */
export const company: Company = {
  legalName: '',
  /** Companies House number, once registered. */
  companyNumber: '',
  registeredAddress: '',
  vatNumber: '',
  supportEmail: '',
  supportPhone: '',

  /**
   * ATOL licence number. Leave EMPTY unless the CAA has issued one to you.
   * See ARCHITECTURE.md — the ATOL question for a flight-only seller using
   * Duffel's accreditations is genuinely unresolved.
   */
  atolNumber: '',
  /** ABTA / ABTOT membership number, if any. Same rule. */
  bondingNumber: '',
};

/**
 * Payment methods we actually accept.
 *
 * Card only, via Duffel Payments. Do not add PayPal, Klarna or Apple Pay icons
 * here to look established — showing a method you don't take is a false claim
 * that costs you the sale at the last screen anyway.
 */
/**
 * Payment methods we actually accept, and the key each maps to in
 * public/payment/ (lowercased, spaces removed — so 'Amex' looks for amex.svg).
 *
 * Card only, via Duffel Payments. Do not add PayPal, Klarna or Apple Pay here to
 * look established: showing a method you don't take is a false claim that loses
 * the sale at the last screen rather than in the footer.
 */
export const acceptedPayments: readonly string[] = ['Visa', 'Mastercard', 'Amex'];

/**
 * Methods we intend to accept but don't yet.
 *
 * The marks are already in public/payment/, so moving one of these into
 * `acceptedPayments` is the entire change once it works. Not rendered anywhere:
 * a footer badge for a method that isn't live either raises an expectation
 * checkout then fails, or reads as a claim we can't back — and 'Apple Pay (soon)'
 * in a footer is a roadmap, which is not what a payment row is for.
 */
export const plannedPayments: readonly string[] = ['Apple Pay', 'Google Pay'];
