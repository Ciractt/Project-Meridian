/**
 * Financial protection disclosure.
 *
 * This is not a courtesy. Where a flight-only sale falls outside ATOL, the seller
 * is expected to make that clear before the customer pays — and the exemptions a
 * seller might rely on carry an explicit condition to tell the consumer the
 * flight is not ATOL protected.
 *
 * Three things it deliberately does NOT say:
 *
 *  - It does not claim ATOL or ABTA protection. Both attach to the company the
 *    customer bought from, and neither transfers from a supplier. An airline's
 *    own ATOL covers bookings made with that airline, not resales of its seats.
 *  - It does not claim to be an "authorised ticket agent for the airline". That
 *    is the language of a specific ATOL exemption which requires a written
 *    agency agreement with each airline on CAA-prescribed terms.
 *  - It does not promise a card refund. Chargeback and Section 75 depend on the
 *    card type, the amount and the payment chain, none of which we can assert.
 *
 * WORDING NOT YET REVIEWED BY A SOLICITOR. It is drafted to be accurate and
 * conservative, but this is the paragraph most worth paying a travel lawyer to
 * check, because it is the one that describes what the customer is and isn't
 * getting.
 */
export function FinancialProtectionNotice({
  variant = 'checkout',
}: {
  variant?: 'checkout' | 'confirmation';
}) {
  return (
    <section
      aria-labelledby="protection-heading"
      className="rounded-card border border-hairline bg-paper p-5"
    >
      <h2
        id="protection-heading"
        className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase"
      >
        Financial protection
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Your ticket is issued by the airline as soon as your payment is taken.
        Flights sold this way are <strong>not covered by the ATOL scheme</strong>, and
        you will not receive an ATOL Certificate.
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Where an airline holds its own ATOL licence or ABTA membership, that applies
        to bookings made directly with them and does not extend to this booking.
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {variant === 'checkout'
          ? 'If the airline stops operating before you travel, your ticket may be worthless. Depending on how you pay, you may be able to claim from your card provider, and travel insurance bought separately may cover it.'
          : 'If the airline stops operating before you travel, contact us and your card provider. Travel insurance bought separately may also cover it.'}
      </p>
    </section>
  );
}
