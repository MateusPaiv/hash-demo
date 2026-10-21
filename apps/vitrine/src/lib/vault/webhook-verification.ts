/**
 * Bridge (api.bridge.xyz/v0) webhook signature verification — production shape.
 *
 * Contract (docs/cofre-contract.md §5.1):
 *   Header: `X-Webhook-Signature: t=<timestamp_ms>,v0=<base64-signature>`
 *   Digest: SHA256(SHA256("<t>.<rawBody>")) — Bridge hashes the payload TWICE,
 *   so the *digest* (not the raw string) goes into crypto.verify, which hashes
 *   again. Replay window: reject deliveries older than 10 minutes.
 *
 * Runs server-side only (node:crypto). Used by `POST /api/webhooks/bridge`
 * and directly by the test harness.
 */
import { createHash, verify as verifySignature } from 'node:crypto';

export const SIGNATURE_TOLERANCE_MS = 10 * 60 * 1000;

export type VerificationFailure =
  | 'missing_header'
  | 'bad_format'
  | 'stale_timestamp'
  | 'invalid_signature';

export type VerificationResult =
  | { valid: true; timestamp: number }
  | { valid: false; failure: VerificationFailure };

/** The double-hashed digest Bridge signs over. Exposed for the demo signer/tests. */
export function bridgeSignatureDigest(timestampMs: number, rawBody: string): Buffer {
  const inner = createHash('sha256').update(`${timestampMs}.${rawBody}`).digest();
  return createHash('sha256').update(inner).digest();
}

export function verifyBridgeWebhookSignature(input: {
  rawBody: string;
  header: string | null;
  publicKeyPem: string;
  /** Injectable clock for tests. */
  nowMs?: number;
}): VerificationResult {
  if (!input.header) return { valid: false, failure: 'missing_header' };

  const parts = input.header.split(',').map((part) => part.trim());
  const tPart = parts.find((part) => part.startsWith('t='));
  const v0Part = parts.find((part) => part.startsWith('v0='));
  if (!tPart || !v0Part) return { valid: false, failure: 'bad_format' };

  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp)) return { valid: false, failure: 'bad_format' };

  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_MS) {
    return { valid: false, failure: 'stale_timestamp' };
  }

  let digest: Buffer;
  try {
    digest = bridgeSignatureDigest(timestamp, input.rawBody);
  } catch {
    return { valid: false, failure: 'invalid_signature' };
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(v0Part.slice(3), 'base64');
  } catch {
    return { valid: false, failure: 'invalid_signature' };
  }
  if (decoded.length === 0) return { valid: false, failure: 'invalid_signature' };

  // Ed25519 keys verify with a null algorithm; RSA-style keys with sha256.
  for (const algorithm of [null, 'sha256'] as const) {
    try {
      if (verifySignature(algorithm, digest, input.publicKeyPem, decoded)) {
        return { valid: true, timestamp };
      }
    } catch {
      // Wrong scheme for this key — try the next one.
    }
  }
  return { valid: false, failure: 'invalid_signature' };
}
