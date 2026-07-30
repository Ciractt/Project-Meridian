import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { verifyDuffelSignature } from '@/features/webhooks/verify';
import { handleDuffelEvent } from '@/features/webhooks/handlers';

/**
 * Duffel webhook receiver.
 *
 * Node runtime, not edge: signature verification uses node:crypto.
 *
 * Order of operations matters throughout:
 *
 *  1. Read the RAW body. Parsing first would re-serialise it and break the hash.
 *  2. Verify the signature before looking at the contents. An unverified endpoint
 *     lets anyone mark orders confirmed or trigger refunds.
 *  3. Claim the event id before handling it. Deliveries are at-least-once and
 *     retried for 72 hours, so the same event will arrive again; claiming first
 *     is the same discipline as claiming a booking attempt before calling Duffel.
 *  4. Return 2xx even for events we don't handle. A non-2xx is retried for three
 *     days, so acknowledging an unknown type is not politeness, it's hygiene.
 *
 * On a handler error we return 500 deliberately, so Duffel retries — the event is
 * released from the dedupe table first, or the retry would be skipped.
 */
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('DUFFEL_WEBHOOK_SECRET is not set — rejecting webhook.');
    // 500 rather than 200: we want Duffel to retry once this is configured
    // rather than silently discard events.
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const rawBody = await request.text();

  const verification = verifyDuffelSignature({
    header: request.headers.get('x-duffel-signature'),
    rawBody,
    secret,
  });

  if (!verification.valid) {
    console.warn('Rejected Duffel webhook:', verification.reason);
    // 400, not 500 — a bad signature is not something a retry will fix, and this
    // response tells an attacker nothing useful.
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: 'missing id or type' }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error('Webhook received but storage is not configured.');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  // Claim the event. A unique violation means we've already processed it.
  const { error: claimError } = await supabase
    .from('webhook_events')
    .insert({ id: event.id, type: event.type });

  if (claimError) {
    // Redelivery of something already handled. Acknowledge and stop.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleDuffelEvent(event as Parameters<typeof handleDuffelEvent>[0]);
    await supabase
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Duffel webhook handler failed:', event.type, message);

    /* Release the claim so Duffel's retry isn't skipped as a duplicate. Without
       this, a transient failure would permanently lose the event — and for
       order.created that means a paid customer never gets their booking. */
    await supabase.from('webhook_events').delete().eq('id', event.id);

    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
