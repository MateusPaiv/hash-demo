/**
 * BACKOFFICE (ops) API — mirrors the future Cofre admin API.
 *
 * Scope differs from the client facade: ops see every customer, every transfer
 * and both internal audit tables (webhook_events, idempotency_keys, and the
 * mocked Resend outbox). Reads are synchronous-ish over the mock store with the
 * same simulated-latency shape as the client facade.
 */
import type { Customer, CustomerStatus, Endorsement, Transfer, TransferState } from '@hash/shared';
import { HAPPY_PATH_STATES, isTerminalState } from '@hash/shared';
import { delay } from '@/lib/mock/latency';
import { loadDB, mutateDB, setAdminSession } from '@/lib/mock/store';
import { enqueueTransferEmail, logSimulatedEvent } from '@/lib/mock/events';
import { APPROVED_ENDORSEMENTS } from '@/lib/mock/machines';
import { toUsd } from '@/lib/metrics';
import { ApiError } from './client';

const ADMIN_EMAIL = 'admin@hash.demo';
const ADMIN_PASSWORD = 'hash-admin-2026';
export { ApiError };

export interface AdminCustomerRow {
  user_id: string;
  customer: Customer;
  user_email: string;
  accounts: number;
  transfers: number;
}

export interface AdminTransferRow {
  transfer: Transfer;
  customer_email: string;
  customer_name: string;
}

export interface AdminMetrics {
  totalVolumeUsd: number;
  feesUsd: number;
  customersByStatus: Record<CustomerStatus, number>;
  transfersByState: Record<TransferState, number>;
  failureRate: number;
}

/** Re-applies a logged event's target state when it would still move the object forward. */
export interface ReplayResult {
  applied: boolean;
  reason: 'applied' | 'duplicate' | 'obsolete' | 'not_found';
}

function customerEmail(customerId: string): { email: string; name: string } {
  const db = loadDB();
  const entry = Object.values(db.customers).find((c) => c.id === customerId);
  return { email: entry?.email ?? 'unknown@hash.demo', name: entry?.full_name ?? 'Unknown' };
}

export const adminApi = {
  auth: {
    async login(input: { email: string; password: string }): Promise<void> {
      await delay(350);
      if (input.email.trim().toLowerCase() !== ADMIN_EMAIL || input.password !== ADMIN_PASSWORD) {
        throw new ApiError('Invalid backoffice credentials', 401);
      }
      setAdminSession(true);
    },

    async logout(): Promise<void> {
      await delay(120);
      setAdminSession(false);
    },
  },

  customers: {
    async list(): Promise<AdminCustomerRow[]> {
      await delay(180);
      const db = loadDB();
      return Object.entries(db.customers).map(([userId, customer]) => ({
        user_id: userId,
        customer,
        user_email: db.users.find((u) => u.id === userId)?.email ?? customer.email,
        accounts: db.external_accounts.filter((a) => a.customer_id === customer.id).length,
        transfers: db.transfers.filter((t) => t.on_behalf_of === customer.id).length,
      }));
    },

    /** Ops decision — plays the exact role Bridge's `customer` webhook will. */
    async decide(userId: string, outcome: 'approved' | 'rejected'): Promise<void> {
      await delay(300);
      mutateDB(['customers'], (draft) => {
        const customer = draft.customers[userId];
        if (!customer) return;
        if (statusRank(customer.status) > statusRank(outcome)) return;
        customer.status = outcome;
        customer.endorsements = outcome === 'approved' ? APPROVED_ENDORSEMENTS : [];
        customer.updated_at = new Date().toISOString();
      });
      const db = loadDB();
      const customer = db.customers[userId];
      if (!customer || customer.status !== outcome) {
        throw new ApiError('Customer not found or already in a later state', 409);
      }
      logSimulatedEvent({
        category: 'customer',
        type: 'customer.updated.status_transitioned',
        objectId: customer.id,
        objectStatus: outcome,
        payload: customer,
      });
    },
  },

  transfers: {
    async list(): Promise<AdminTransferRow[]> {
      await delay(180);
      const db = loadDB();
      return [...db.transfers]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .map((transfer) => {
          const info = customerEmail(transfer.on_behalf_of);
          return {
            transfer,
            customer_email: info.email,
            customer_name: info.name,
          };
        });
    },

    /** Manual cancel — same Window as Bridge: only while awaiting_funds. */
    async cancel(id: string): Promise<void> {
      await delay(250);
      const db = loadDB();
      const transfer = db.transfers.find((t) => t.id === id);
      if (!transfer) throw new ApiError('Transfer not found', 404);
      if (transfer.state !== 'awaiting_funds') {
        throw new ApiError('Only transfers awaiting funds can be canceled', 409);
      }
      mutateDB(['transfers'], (draft) => {
        const t = draft.transfers.find((x) => x.id === id)!;
        t.state = 'canceled';
        t.updated_at = new Date().toISOString();
      });
      const canceled = loadDB().transfers.find((x) => x.id === id)!;
      logSimulatedEvent({
        category: 'transfer',
        type: 'transfer.updated.status_transitioned',
        objectId: canceled.id,
        objectStatus: 'canceled',
        payload: canceled,
      });
      enqueueTransferEmail(canceled);
    },
  },

  webhooks: {
    async list() {
      await delay(150);
      return [...loadDB().webhook_events].sort(
        (a, b) => Date.parse(b.received_at) - Date.parse(a.received_at),
      );
    },

    /** Replay an event delivery: idempotent by construction. */
    async replay(eventId: string): Promise<ReplayResult> {
      await delay(250);
      const db = loadDB();
      const row = db.webhook_events.find((e) => e.event_id === eventId);
      if (!row) return { applied: false, reason: 'not_found' };

      if (row.event_category === 'transfer') {
        const target = row.event_object_status as TransferState | undefined;
        const live = db.transfers.find((t) => t.id === row.event_object_id);
        if (!live || !target) return { applied: false, reason: 'not_found' };
        if (live.state === target) return { applied: false, reason: 'duplicate' };
        const liveIdx = (HAPPY_PATH_STATES as readonly string[]).indexOf(live.state);
        const targetIdx = (HAPPY_PATH_STATES as readonly string[]).indexOf(target);
        if (targetIdx > liveIdx) {
          mutateDB(['transfers'], (draft) => {
            const t = draft.transfers.find((x) => x.id === live.id)!;
            t.state = target;
            t.updated_at = new Date().toISOString();
            if (target === 'payment_processed' && !t.receipt) {
              t.receipt = {
                transaction_hash: `0x${crypto.randomUUID().replaceAll('-', '')}${crypto
                  .randomUUID()
                  .replaceAll('-', '')}`.slice(0, 66),
              };
            }
          });
          return { applied: true, reason: 'applied' };
        }
        return { applied: false, reason: 'obsolete' };
      }

      if (row.event_category === 'customer') {
        const target = row.event_object_status as CustomerStatus | undefined;
        const entry = Object.entries(db.customers).find(
          ([, c]) => c.id === row.event_object_id,
        );
        if (!entry || !target) return { applied: false, reason: 'not_found' };
        const [userId, customer] = entry;
        if (customer.status === target) return { applied: false, reason: 'duplicate' };
        if (statusRank(customer.status) > statusRank(target)) {
          return { applied: false, reason: 'obsolete' };
        }
        mutateDB(['customers'], (draft) => {
          const c = draft.customers[userId];
          c.status = target;
          c.updated_at = new Date().toISOString();
        });
        return { applied: true, reason: 'applied' };
      }

      return { applied: true, reason: 'applied' };
    },
  },

  idempotency: {
    async list() {
      await delay(150);
      const db = loadDB();
      const now = Date.now();
      return [...db.idempotency_keys]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .map((row) => ({ ...row, expired: Date.parse(row.expires_at) < now }));
    },
  },

  emails: {
    async list() {
      await delay(150);
      return [...loadDB().email_outbox].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      );
    },

    /** Stands in for the live Resend call once RESEND_API_KEY exists. */
    async send(id: string): Promise<void> {
      await delay(300);
      const db = loadDB();
      const row = db.email_outbox.find((e) => e.id === id);
      if (!row) throw new ApiError('Outbox item not found', 404);
      mutateDB(['email_outbox'], (draft) => {
        const e = draft.email_outbox.find((x) => x.id === id)!;
        e.status = 'sent';
      });
    },
  },

  fees: {
    /** GET /developer/fees parity: platform take-rate + receiving-account info. */
    async get(): Promise<{ percent: string; feePayoutAccount: string }> {
      await delay(150);
      return {
        percent: loadDB().platform_fee_percent || '1.0',
        feePayoutAccount: 'Lead Bank (Mock) · routing 021000021 · account ••••8899',
      };
    },

    /** PUT /developer/fees parity: platform take-rate, 0–5%. */
    async set(percent: string): Promise<void> {
      await delay(250);
      const value = Number(percent);
      if (!Number.isFinite(value) || value < 0 || value > 5) {
        throw new ApiError('Fee must be between 0 and 5 percent', 422);
      }
      mutateDB(['config'], (db) => {
        db.platform_fee_percent = value.toFixed(2);
      });
    },
  },

  metrics: {
    async global(): Promise<AdminMetrics> {
      await delay(120);
      const db = loadDB();
      const customersByStatus = tally(
        Object.values(db.customers).map((c) => c.status),
        ['not_started', 'incomplete', 'under_review', 'approved', 'rejected'],
      );
      const transfersByState = tally(
        db.transfers.map((t) => t.state),
        [
          'awaiting_funds', 'in_review', 'funds_received', 'payment_submitted',
          'payment_processed', 'canceled', 'undeliverable', 'returned',
          'refund_in_flight', 'refund_failed', 'refunded',
        ],
      );
      const terminal = db.transfers.filter((t) => isTerminalState(t.state));
      const failures = db.transfers.filter((t) =>
        ['undeliverable', 'returned', 'refund_failed', 'refunded'].includes(t.state),
      ).length;
      const fees = db.transfers
        .filter((t) => t.state === 'payment_processed')
        .reduce((acc, t) => acc + toUsd(t.developer_fee, t.source.currency), 0);
      const volume = db.transfers
        .filter((t) => t.state === 'payment_processed')
        .reduce((acc, t) => acc + toUsd(t.amount, t.source.currency), 0);
      return {
        totalVolumeUsd: volume,
        feesUsd: fees,
        customersByStatus,
        transfersByState,
        failureRate: terminal.length === 0 ? 0 : failures / terminal.length,
      };
    },
  },
};

function statusRank(status: CustomerStatus): number {
  const order: CustomerStatus[] = ['rejected', 'not_started', 'incomplete', 'under_review', 'approved'];
  return order.indexOf(status);
}

function tally<T extends string>(values: T[], keys: T[]): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const key of keys) result[key] = 0;
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}
