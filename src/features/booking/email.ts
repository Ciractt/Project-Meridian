import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { isEmailConfigured, sendEmail } from '@/services/resend/client';
import { absoluteUrl } from '@/lib/url';
import { formatMoney } from '@/lib/format';
import { formatFull } from '@/lib/date';
import { env } from '@/lib/env';

/**
 * The confirmation email.
 *
 * Sent from two places — `completeBooking` after the orders row is written, and
 * the `order.created` webhook for orders that resolved from a 202 — because
 * those are the two ways an order comes to exist, and each may be the only one
 * that fires.
 *
 * Three properties this has to hold:
 *
 *  1. **It never fails a booking.** The ticket is already issued by the time we
 *     get here. Everything is wrapped so this function cannot throw; a failure
 *     is logged and that is all.
 *
 *  2. **It never sends twice.** `confirmation_email_sent_at` is claimed with an
 *     atomic conditional update before the send. Whichever caller wins the
 *     null → timestamp transition sends; every other caller (a webhook
 *     redelivery, or the webhook firing after completeBooking already sent)
 *     matches zero rows and returns. This is at-most-once by design: a Resend
 *     failure does NOT clear the flag, because "must not send twice" outranks
 *     guaranteed delivery and the /booking link is the durable confirmation
 *     regardless. The only exposure is the lost-ack case (Resend sent but the
 *     response was lost), which is rare and, for a receipt, harmless either way.
 *
 *  3. **It contains nothing the /booking/[orderId] page doesn't already show.**
 *     Reference, route, dates, travellers, total paid, and the link. No dates of
 *     birth, no passport details — those are never persisted (ADR-018), and the
 *     link is a capability URL, so the email must not widen what it exposes.
 *
 * Transactional: no marketing footer, no unsubscribe link.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    // Skip before claiming when we can't send at all, so a later configured run
    // (a webhook redelivery) can still pick it up.
    if (!isEmailConfigured()) return;

    const supabase = getSupabaseServiceClient();
    if (!supabase) return;

    // Claim and fetch in one atomic step. `.is(...null)` guards the transition;
    // Postgres row-locking means only one concurrent caller sees it as null.
    const { data: order, error } = await supabase
      .from('orders')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .is('confirmation_email_sent_at', null)
      .select(
        'id, booking_reference, origin, destination, departure_date, return_date, passenger_count, charged_amount, charged_currency, contact_email',
      )
      .maybeSingle<{
        id: string;
        booking_reference: string | null;
        origin: string;
        destination: string;
        departure_date: string;
        return_date: string | null;
        passenger_count: number;
        charged_amount: string | null;
        charged_currency: string | null;
        contact_email: string;
      }>();

    if (error) {
      console.error('Could not claim confirmation email for order %s:', orderId, error.message);
      return;
    }
    // No row means it was already claimed (sent, or in flight elsewhere), or the
    // order doesn't exist. Either way, nothing to do.
    if (!order) return;

    const link = absoluteUrl(`/booking/${order.id}`);
    if (!link) {
      // No usable origin means the email's whole point — getting the traveller
      // back to their booking — can't be delivered. Don't send a linkless one.
      console.error('No site URL configured; skipping confirmation email for order', orderId);
      return;
    }

    const content = renderConfirmation({
      reference: order.booking_reference,
      origin: order.origin,
      destination: order.destination,
      departureDate: order.departure_date,
      returnDate: order.return_date,
      passengerCount: order.passenger_count,
      chargedAmount: order.charged_amount,
      chargedCurrency: order.charged_currency,
      link,
    });

    await sendEmail({
      to: order.contact_email,
      from: env.EMAIL_FROM!,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (err) {
    // The booking is ticketed. An email problem is ours to notice, never the
    // traveller's to suffer — log and carry on.
    console.error('Confirmation email failed for order %s:', orderId, err);
  }
}

interface ConfirmationContent {
  reference: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  passengerCount: number;
  chargedAmount: string | null;
  chargedCurrency: string | null;
  link: string;
}

function renderConfirmation(c: ConfirmationContent): {
  subject: string;
  html: string;
  text: string;
} {
  const route = `${c.origin} → ${c.destination}`;
  const travellers = `${c.passengerCount} ${c.passengerCount === 1 ? 'traveller' : 'travellers'}`;
  const paid =
    c.chargedAmount && c.chargedCurrency
      ? formatMoney(c.chargedAmount, c.chargedCurrency)
      : null;
  const outbound = formatFull(c.departureDate);
  const dates = c.returnDate ? `${outbound} — ${formatFull(c.returnDate)}` : outbound;

  const subject = c.reference
    ? `Your Meridian booking ${c.reference} — ${route}`
    : `Your Meridian booking — ${route}`;

  const rows: Array<[string, string]> = [];
  if (c.reference) rows.push(['Airline reference', c.reference]);
  rows.push(['Route', route]);
  rows.push([c.returnDate ? 'Dates' : 'Departure', dates]);
  rows.push(['Travellers', travellers]);
  if (paid) rows.push(['Total paid', paid]);

  const text = [
    'You’re booked.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'View your booking:',
    c.link,
    '',
    'Keep this email or the reference above. Changes and cancellations are subject to the airline’s own fare rules.',
  ].join('\n');

  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5b5b5b;font-size:14px;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 20px;">You’re booked.</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:28px;">
      ${rowHtml}
    </table>
    <a href="${escapeHtml(c.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">View your booking</a>
    <p style="color:#8a8a8a;font-size:12px;line-height:1.5;margin:28px 0 0;">
      Keep this email or the reference above. Changes and cancellations are subject to the airline’s own fare rules.
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
