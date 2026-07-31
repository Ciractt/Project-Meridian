import Link from 'next/link';
import { acceptedPayments, company } from '@/lib/company';
import { FEATURED_ROUTES, routeSearchHref } from '@/features/destinations/routes';
import { PAYMENT_MARKS } from '@/lib/payment-marks.generated';

/**
 * Site footer.
 *
 * Structured like the incumbents' — columns for company, support, legal and
 * destinations — because that shape does real work: it carries the legal
 * disclosures a travel seller has to make, and the internal links search engines
 * use to find route pages.
 *
 * Everything driven by `lib/company.ts` is omitted when blank rather than
 * rendered as a placeholder. A footer claiming an ATOL number you don't hold is
 * a misrepresentation, and one listing payment methods you don't take loses the
 * sale at checkout instead of the footer. Both are worse than an honest gap.
 */


export function SiteFooter() {
  return (
    /* No top margin. Every page above this ends on a surface, and the gap was
       rendering as a band of paper between two white blocks — an empty section
       rather than breathing room. The space now lives inside the footer. */
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-5 pt-16 pb-12">
        {/* Says who we are before it says where to click. Every claim in it is
            made elsewhere on the site and can be backed — this is the one place
            they are said in one breath, so it is also the easiest place to
            overclaim by accident. It stops where the evidence stops. */}
        <div className="mb-12 max-w-xl">
          <p className="font-display text-2xl font-extrabold tracking-tight">
            Welcome aboard.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Booking a flight shouldn’t need a spreadsheet. We show the whole
            price on the first result — airline fare, taxes and our fee — tell
            you what the fare actually includes, and re-check the live price
            with the airline before your card is charged. No account needed to
            start.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <Column title="Meridian">
            <FooterLink href="/about">Who we are</FooterLink>
            <FooterLink href="/how-it-works">How booking works</FooterLink>
            <FooterLink href="/pricing-promise">Our pricing promise</FooterLink>
          </Column>

          <Column title="Support">
            <FooterLink href="/help">Help centre</FooterLink>
            {company.supportEmail ? (
              <FooterLink href={`mailto:${company.supportEmail}`}>
                {company.supportEmail}
              </FooterLink>
            ) : null}
            {company.supportPhone ? (
              <FooterLink href={`tel:${company.supportPhone.replace(/\s/g, '')}`}>
                {company.supportPhone}
              </FooterLink>
            ) : null}
            <FooterLink href="/help/changes-and-refunds">
              Changes and refunds
            </FooterLink>
            <FooterLink href="/accessibility">Accessibility</FooterLink>
          </Column>

          <Column title="Legal">
            <FooterLink href="/terms">Terms of service</FooterLink>
            <FooterLink href="/privacy">Privacy policy</FooterLink>
            <FooterLink href="/cookies">Cookie policy</FooterLink>
            <FooterLink href="/passenger-rights">Your rights when flying</FooterLink>
          </Column>

          <Column title="Popular routes">
            {FEATURED_ROUTES.map((route) => (
              <FooterLink
                key={`${route.from}-${route.to}`}
                href={routeSearchHref(route)}
              >
                {route.fromCity} to {route.toCity}
              </FooterLink>
            ))}
          </Column>
        </div>

        <div className="mt-12 border-t border-hairline pt-8">
          <p className="text-xs font-medium text-ink-faint">
            Payment
          </p>
          {/* Official marks where we have them, a text badge where we don't. A
              redrawn approximation of a card logo is a trademark problem, so the
              fallback is deliberately not logo-shaped. */}
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {acceptedPayments.map((method) => {
              const mark = PAYMENT_MARKS[method.toLowerCase().replace(/\s+/g, '')];
              return (
                <li key={method}>
                  {mark ? (
                    /* No border or padding: the mark draws its own card, including
                       rounded corners and an edge. The art is inset within a 32×32
                       viewBox — the card occupies 18 units of height — so h-10
                       renders a card about 22px tall. Sizing it to the box would
                       give a mark half the intended size. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mark} alt={method} className="h-10 w-auto" />
                  ) : (
                    <span className="inline-block rounded border border-hairline px-2.5 py-1.5 text-xs text-ink-muted">
                      {method}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 max-w-2xl text-xs text-ink-faint">
            Card details are handled by our payment provider and never reach our
            servers.
          </p>
        </div>

        <div className="mt-8 space-y-2 border-t border-hairline pt-8 text-xs leading-relaxed text-ink-faint">
          {company.legalName ? (
            <p>
              {company.legalName}
              {company.companyNumber
                ? `, registered in England and Wales no. ${company.companyNumber}`
                : ''}
              {company.registeredAddress ? `. ${company.registeredAddress}` : ''}
              {company.vatNumber ? `. VAT ${company.vatNumber}` : ''}
            </p>
          ) : null}

          {company.atolNumber ? (
            <p>Flight-inclusive holidays are protected under ATOL {company.atolNumber}.</p>
          ) : null}

          {/* Deliberately NOT "we sell as agent for the airline". That is the
              wording of a specific ATOL exemption which requires a written agency
              agreement with each airline on CAA-prescribed terms. Claiming the
              status without the agreements is the same class of error as
              displaying an ATOL number you weren't issued. Replace this paragraph
              only on legal advice. */}
          <p>
            Fares, baggage allowances and change rules are set by the airline and are
            shown in full before you pay. Tickets are issued by the airline at the
            time of payment.
          </p>

          <p>
            Flights sold here are not covered by the ATOL scheme and no ATOL
            Certificate is issued. An airline’s own ATOL licence or ABTA membership
            applies to bookings made directly with that airline and does not extend
            to bookings made here.{' '}
            <Link
              href="/financial-protection"
              className="underline underline-offset-2 hover:no-underline"
            >
              What this means
            </Link>
          </p>

          <p>© {new Date().getFullYear()} Meridian. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium text-ink-faint">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-ink-muted transition-colors hover:text-ink"
      >
        {children}
      </Link>
    </li>
  );
}
