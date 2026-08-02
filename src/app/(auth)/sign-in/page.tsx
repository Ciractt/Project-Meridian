import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signIn } from '@/features/auth/actions';
import { AuthForm } from '@/features/auth/components/auth-form';
import { getCurrentUser } from '@/features/auth/queries';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/account');
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-ink-muted">
        Your bookings and saved searches, in one place.
      </p>

      <AuthForm action={signIn} mode="sign-in" next={next} />

      <p className="mt-6 text-sm text-ink-muted">
        No account yet?{' '}
        <Link href="/sign-up" className="text-link underline underline-offset-2">
          Create one
        </Link>
      </p>
    </div>
  );
}
