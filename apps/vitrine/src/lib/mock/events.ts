/**
 * Simulated Bridge → Cofre delivery pipeline.
 *
 * Every state transition the demo performs is also appended to the
 * `webhook_events` audit trail (dedupe by event_id, like production), and
 * terminal transfer states enqueue the transactional email (Resend pipeline,
 * mocked until the API key exists).
 */
import type { FiatCurrency, Transfer } from '@hash/shared';
import { loadDB, mutateDB } from './store';

const MAX_EVENTS = 200; // trim the audit trail like a ring buffer

interface EventInput {
  category: string;
  type: string;
  objectId: string;
  objectStatus?: string;
  payload: unknown;
  /** Marked false for the simulated path — the live receiver sets it true. */
  verified?: boolean;
}

export function logSimulatedEvent(input: EventInput): void {
  mutateDB(['webhook_events'], (db) => {
    db.webhook_events.push({
      event_id: `wh_${crypto.randomUUID()}`,
      event_category: input.category,
      event_type: input.type,
      event_object_id: input.objectId,
      event_object_status: input.objectStatus,
      payload: input.payload,
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      delivery: 'simulated',
      verified: input.verified ?? false,
    });
    if (db.webhook_events.length > MAX_EVENTS) {
      db.webhook_events = db.webhook_events.slice(-MAX_EVENTS);
    }
  });
}

export function emailForCustomerEmail(
  lookupCustomerId: string,
): string {
  const db = loadDB();
  const entry = Object.values(db.customers).find((c) => c.id === lookupCustomerId);
  return entry?.email ?? 'unknown@hash.demo';
}

interface EmailInput {
  customerId: string;
  template: 'transfer.completed' | 'transfer.canceled' | 'transfer.refunded';
  subject: string;
  payload: Record<string, string>;
}

export function enqueueEmail(input: EmailInput): void {
  mutateDB(['email_outbox'], (db) => {
    db.email_outbox.push({
      id: `em_${crypto.randomUUID()}`,
      to: emailForCustomerEmail(input.customerId),
      template: input.template,
      subject: input.subject,
      payload: input.payload,
      status: 'queued',
      created_at: new Date().toISOString(),
    });
  });
}

/** Transactional email policy: one mail per terminal transfer state. */
export function enqueueTransferEmail(transfer: Transfer): void {
  const templates = {
    payment_processed: {
      template: 'transfer.completed' as const,
      subject: 'Your transfer was completed',
      payload: {
        amount: transfer.amount,
        currency: transfer.destination.currency,
        receipt: transfer.receipt?.transaction_hash ?? '',
      },
    },
    canceled: {
      template: 'transfer.canceled' as const,
      subject: 'Your transfer was canceled',
      payload: { amount: transfer.amount, currency: transfer.source.currency },
    },
    refunded: {
      template: 'transfer.refunded' as const,
      subject: 'Your transfer was refunded',
      payload: { amount: transfer.amount, currency: transfer.source.currency },
    },
  };
  const match = templates[transfer.state as keyof typeof templates];
  if (!match) return; // refund_in_flight/failed etc. wait for their terminal sibling
  enqueueEmail({ customerId: transfer.on_behalf_of, ...match });
}

/** Virtual-account deposit ledger: a fiat-funded transfer registers a pending deposit. */
export function recordVirtualDeposit(input: {
  customer_id: string;
  currency: FiatCurrency;
  amount: string;
  transfer_id?: string;
}): void {
  mutateDB(['virtual_activity'], (db) => {
    db.virtual_activity.push({
      id: `va_act_${crypto.randomUUID()}`,
      customer_id: input.customer_id,
      currency: input.currency,
      amount: input.amount,
      status: 'pending',
      transfer_id: input.transfer_id,
      created_at: new Date().toISOString(),
    });
  });
}

/** funds_received settles the deposits that funded the transfer. */
export function settleVirtualDeposits(transferId: string): void {
  mutateDB(['virtual_activity'], (db) => {
    for (const row of db.virtual_activity) {
      if (row.transfer_id === transferId && row.status === 'pending') {
        row.status = 'received';
        row.settled_at = new Date().toISOString();
      }
    }
  });
}
