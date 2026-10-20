/**
 * Bridge API (v0) — Webhook event envelope.
 *
 * Delivered to the Cofre's webhook receiver. Signature verification and
 * dedupe rules live in docs/cofre-contract.md; these types describe the
 * payload itself.
 */

/** Core MVP event categories the receiver must handle. */
export type BridgeEventCategory =
  | 'customer'
  | 'kyc_link'
  | 'transfer'
  | 'virtual_account.activity'
  | 'external_account';

export interface BridgeWebhookEvent<TObject = unknown> {
  api_version: 'v0';
  /** Unique delivery ID — primary dedupe key (store in webhook_events). */
  event_id: string;
  /** Monotonic sequence per endpoint — use for ordering, not dedupe. */
  event_sequence: number;
  event_developer_id: string;
  event_category: BridgeEventCategory;
  /** e.g. "customer.updated.status_transitioned". */
  event_type: string;
  /** ID of the affected object (customer ID, transfer ID, ...). */
  event_object_id: string;
  event_object_status?: string;
  /** Full object snapshot at event time. */
  event_object: TObject;
  /** Field-level [before, after] pairs for changed fields. */
  event_object_changes?: Record<string, [unknown, unknown]>;
  event_created_at: string;
}
