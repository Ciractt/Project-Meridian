import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Attach guest bookings to the account that owns their contact email.
 *
 * A booking made without a session goes in with `user_id: null`, and nothing
 * ever set it afterwards. So the confirmation page's "Sign in to save this
 * trip" button did nothing at all — signing in left the row untouched, the
 * booking never appeared in /account, and the button had said otherwise. This
 * is what makes that claim true.
 *
 * **The email must be one Supabase has confirmed.** That is the whole
 * authorisation argument: the account holder proved they can receive mail at
 * that address, and the booking's contact address is where the ticket was
 * sent. Anyone who controls the inbox already has the ticket.
 *
 * It is also a weaker claim than one already granted elsewhere:
 * `cancellation.ts` treats knowing the contact email as sufficient to *cancel*
 * a booking. Matching a confirmed address in order to *view* one is strictly
 * less than that.
 *
 * Service client, because the rows being claimed have `user_id: null` and no
 * RLS policy can match a row to a user it is not yet attached to. `WHERE
 * user_id IS NULL` is the guard that matters: a booking already attached to
 * someone is never reassigned, so a recycled or shared address cannot take a
 * trip away from the account that holds it.
 *
 * Never throws. Every caller is on a path — signing in, confirming an email —
 * where failing loudly would be worse than not claiming: the booking is still
 * reachable by reference and email, and the next sign-in tries again.
 */
export async function claimOrdersForEmail(
  userId: string,
  email: string | undefined,
): Promise<number> {
  if (!email) return 0;

  const supabase = getSupabaseServiceClient();
  if (!supabase) return 0;

  const normalised = email.trim().toLowerCase();
  if (!normalised) return 0;

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ user_id: userId })
      .is('user_id', null)
      .ilike('contact_email', normalised)
      .select('id');

    if (error) {
      console.error('Could not claim guest bookings:', error.message);
      return 0;
    }

    return data?.length ?? 0;
  } catch (cause) {
    console.error('Could not claim guest bookings:', cause);
    return 0;
  }
}
