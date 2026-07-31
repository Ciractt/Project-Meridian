import Link from 'next/link';
import { requireUser } from '@/features/auth/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  AddressForm,
  EmailForm,
  PasswordForm,
  TravellerNameForm,
} from '@/features/auth/components/settings-forms';

export const metadata = { title: 'Your account' };

export default async function AccountSettingsPage() {
  const user = await requireUser('/account/settings');
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('profiles')
    .select(
      'passport_given_name, passport_family_name, address_line1, address_line2, address_city, address_postcode, address_country',
    )
    .eq('id', user.id)
    .maybeSingle();

  const profile = {
    passportGivenName: String(data?.passport_given_name ?? ''),
    passportFamilyName: String(data?.passport_family_name ?? ''),
    addressLine1: String(data?.address_line1 ?? ''),
    addressLine2: String(data?.address_line2 ?? ''),
    addressCity: String(data?.address_city ?? ''),
    addressPostcode: String(data?.address_postcode ?? ''),
    addressCountry: String(data?.address_country ?? ''),
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/account" className="text-airway underline underline-offset-2">
          Your trips
        </Link>
      </nav>

      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Your account
      </h1>

      <div className="mt-8 space-y-10">
        <Section title="Traveller name">
          <TravellerNameForm profile={profile} />
        </Section>

        <Section title="Email">
          <EmailForm currentEmail={user.email ?? ''} />
        </Section>

        <Section title="Password">
          <PasswordForm />
        </Section>

        <Section title="Address">
          <AddressForm profile={profile} />
        </Section>

        <section className="rounded-card border border-hairline bg-paper p-6">
          <h2 className="font-display text-base font-bold tracking-tight">
            What we don’t keep
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            We never store passport or identity document numbers, and your card
            details never reach our servers. Traveller names and dates of birth are
            held by the airline against your booking rather than by us.{' '}
            <Link href="/privacy" className="text-airway underline underline-offset-2">
              Our privacy policy
            </Link>{' '}
            sets out the rest.
          </p>
        </section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-bold tracking-tight">{title}</h2>
      <div className="rounded-card border border-hairline bg-surface p-6">{children}</div>
    </section>
  );
}
