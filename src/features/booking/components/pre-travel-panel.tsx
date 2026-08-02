import { countryName, type PreTravelGuidance } from '../pre-travel';

/**
 * What the traveller has to do next.
 *
 * Every line here is either a fact about the booking or a pointer to an
 * authority. Nothing tells a specific person whether they need a visa, because
 * we don't know their nationality, purpose of travel or length of stay — and
 * getting it wrong means denied boarding and a wasted fare.
 *
 * The phrasing is deliberate throughout: "many destinations require", not "you
 * need"; "most UK travellers", not "you". The distinction between describing a
 * general rule and advising an individual is the whole difference between
 * helpful and liable.
 */
/**
 * Condensed version for the review page, shown BEFORE payment.
 *
 * Telling someone they need a visa after they've paid is nearly useless — it's
 * the one piece of information that might change whether they book at all. So the
 * entry-requirement warning appears on both sides of the payment, and this
 * variant deliberately leads with it.
 */
export function PreTravelNotice({
  guidance,
  airlineName,
}: {
  guidance: PreTravelGuidance;
  airlineName: string | null;
}) {
  if (!guidance.isInternational && !guidance.documentsOutstanding) return null;

  return (
    <section className="rounded-card border border-caution/30 bg-caution-wash p-5">
      <h2 className="font-display text-sm font-bold tracking-tight text-caution">
        Check before you book
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
        {guidance.isInternational ? (
          <li>
            This trip enters{' '}
            <strong>
              {guidance.destinationCountries.map((code) => countryName(code)).join(', ')}
            </strong>
            {guidance.transitCountries.length > 0
              ? `, passing through ${guidance.transitCountries.map((code) => countryName(code)).join(', ')}`
              : ''}
            . Visa and entry rules depend on your nationality and length of stay, so
            check{' '}
            <Anchor href="https://www.gov.uk/foreign-travel-advice">
              gov.uk foreign travel advice
            </Anchor>{' '}
            before paying — tickets are usually non-refundable if you’re refused
            entry.
          </li>
        ) : null}
        {guidance.touchesUnitedStates ? (
          <li>
            United States travel normally needs an approved{' '}
            <Anchor href="https://esta.cbp.dhs.gov/">ESTA</Anchor> or a visa in
            advance. Approval isn’t always instant.
          </li>
        ) : null}
        {guidance.documentsOutstanding ? (
          <li>
            {airlineName ?? 'The airline'} will need your passport details before
            check-in. You’ll add those with them after booking.
          </li>
        ) : null}
        {guidance.isInternational ? (
          <li>
            Many destinations require a passport valid for six months beyond your
            return date.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function PreTravelPanel({
  guidance,
  bookingReference,
  airlineName,
}: {
  guidance: PreTravelGuidance;
  bookingReference: string | null;
  airlineName: string | null;
}) {
  const airline = airlineName ?? 'the airline';

  return (
    <section className="mt-6 rounded-card border border-hairline bg-surface p-6">
      <h2 className="font-display text-base font-bold tracking-tight">
        Before you travel
      </h2>

      <ol className="mt-4 space-y-5">
        {guidance.documentsOutstanding ? (
          <Step
            index={1}
            title="Add your passport details with the airline"
            tone="caution"
          >
            {airline} didn’t require passport details at booking, but will need them
            before you can check in.
            {bookingReference ? (
              <>
                {' '}
                Use reference{' '}
                <span className="tabular-nums font-semibold">{bookingReference}</span> on
                their site.
              </>
            ) : null}
            {guidance.touchesUnitedStates
              ? ' Flights to and from the United States require this in advance — the airline cannot issue a boarding pass without it.'
              : ''}
          </Step>
        ) : null}

        {guidance.isInternational ? (
          <Step index={2} title="Check entry requirements yourself" tone="caution">
            This trip enters{' '}
            <strong>
              {guidance.destinationCountries.map((code) => countryName(code)).join(', ')}
            </strong>
            {guidance.transitCountries.length > 0 ? (
              <>
                , passing through{' '}
                <strong>
                  {guidance.transitCountries.map((code) => countryName(code)).join(', ')}
                </strong>
                {' '}— transit countries can have their own visa rules even if you
                don’t leave the airport
              </>
            ) : null}
            .
            <br />
            <br />
            Whether you need a visa depends on your nationality, how long you’re
            staying and why — so we can’t answer it for you, and you shouldn’t rely on
            anyone who says they can without knowing all three. Check{' '}
            <Anchor href="https://www.gov.uk/foreign-travel-advice">
              gov.uk foreign travel advice
            </Anchor>{' '}
            for each country you’re entering.
            {guidance.touchesUnitedStates ? (
              <>
                <br />
                <br />
                For the United States, most short-stay visitors from visa-waiver
                countries need an approved{' '}
                <Anchor href="https://esta.cbp.dhs.gov/">ESTA</Anchor> before
                travelling, and others need a visa. Apply well ahead — approval isn’t
                always instant.
              </>
            ) : null}
            <br />
            <br />
            Many destinations also require a passport valid for six months beyond your
            return date, which catches people out more often than visas do.
          </Step>
        ) : null}

        <Step index={3} title="Check in online">
          Most airlines open check-in 24 to 48 hours before departure — around{' '}
          <strong>{guidance.checkInOpensAround}</strong> for this trip. That’s
          approximate; {airline} sets the exact window, and some low-cost carriers
          charge for airport check-in if you miss it.
        </Step>

        <Step index={4} title="Get to the airport in good time">
          Allow about <strong>{guidance.airportHours} hours</strong> before departure
          for {guidance.isInternational ? 'this international' : 'this'} flight —
          longer at busy times or if you’re checking bags.
        </Step>
      </ol>

      <p className="mt-6 border-t border-hairline pt-4 text-xs text-ink-faint">
        Entry requirements and airline rules change. Everything above is general
        guidance, not advice about your circumstances — the airline and the
        authorities of each country are the only sources that can confirm your
        position.
      </p>
    </section>
  );
}

function Step({
  index,
  title,
  tone = 'neutral',
  children,
}: {
  index: number;
  title: string;
  tone?: 'neutral' | 'caution';
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className={`flex size-7 shrink-0 items-center justify-center rounded-full tabular-nums text-xs ${
          tone === 'caution'
            ? 'bg-caution-wash text-caution'
            : 'bg-paper text-ink-muted'
        }`}
      >
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
          {children}
        </span>
      </span>
    </li>
  );
}

function Anchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link underline underline-offset-2"
    >
      {children}
    </a>
  );
}
