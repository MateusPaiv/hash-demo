import { verifyBridgeWebhookSignature } from '@/lib/vault/webhook-verification';

/**
 * The Cofre's webhook receiver, production shape (spec: docs/cofre-contract.md §5).
 *
 * Verify-before-parse, replay-window check, then acknowledge fast. In the live
 * Vault, a verified event is deduped on `event_id` into Supabase (`webhook_events`)
 * and processed asynchronously — the DB writes fan out over Supabase Realtime.
 * In this demo build the mock store persists client-side, so the endpoint's job
 * is the cryptographic verdict; the simulated pipeline marks its deliveries
 * with delivery: 'simulated' on the audit trail.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const header = request.headers.get('X-Webhook-Signature');
  const publicKeyPem = process.env.BRIDGE_WEBHOOK_PUBLIC_KEY;

  if (!publicKeyPem) {
    return Response.json(
      {
        error: {
          code: 'not_configured',
          message:
            'Receiver not configured — set BRIDGE_WEBHOOK_PUBLIC_KEY (per-endpoint PEM) to enable signature verification.',
        },
      },
      { status: 503 },
    );
  }

  const verdict = verifyBridgeWebhookSignature({ rawBody, header, publicKeyPem });
  if (!verdict.valid) {
    return Response.json(
      { error: { code: verdict.failure, message: 'Webhook rejected by the receiver.' } },
      { status: 400 },
    );
  }

  let eventId: string | null = null;
  try {
    const parsed = JSON.parse(rawBody) as { event_id?: string; event_sequence?: number };
    eventId = parsed.event_id ?? null;
    // Production: INSERT INTO webhook_events ... ON CONFLICT (event_id) DO NOTHING,
    // return 200 immediately on duplicates, process async afterward.
  } catch {
    return Response.json(
      { error: { code: 'bad_format', message: 'Malformed JSON payload.' } },
      { status: 400 },
    );
  }

  return Response.json({ received: true, event_id: eventId, verified: true });
}
