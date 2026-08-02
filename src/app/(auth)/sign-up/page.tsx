import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUp } from '@/features/auth/actions';
import { AuthForm } from '@/features/auth/components/auth-form';
import { getCurrentUser } from '@/features/auth/queries';

export const metadata = { title: 'Create account' };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/account');

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Create account
      </h1>
      <p className="mt-2 mb-8 text-sm text-ink-muted">
        You don’t need an account to search or book. It’s for keeping track of trips
        afterwards.
      </p>

      <AuthForm action={signUp} mode="sign-up" />

      <p className="mt-6 text-sm text-ink-muted">
        Already registered?{' '}
        <Link href="/sign-in" className="text-link underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
