/**
 * State machines — simulate Bridge webhook deliveries.
 *
 * In production, state changes arrive at the Cofre as signed webhooks, get
 * written to Postgres, and fan out over Supabase Realtime. Here, timers
 * play the role of the webhook receiver and `mutateDB` plays the Realtime
 * broadcast. Timing is compressed so the demo is watchable.
 */
import type { Endorsement, TransferState } from '@hash/shared';
import { HAPPY_PATH_STATES, TERMINAL_TRANSFER_STATES } from '@hash/shared';
import { loadDB, mutateDB } from './store';
import { generateTxHash } from './fixtures';
import { enqueueTransferEmail, logSimulatedEvent, settleVirtualDeposits } from './events';

const armed = new Set<string>();

const KYC_DECISION_MS = 5_000;
const TRANSITION_MS: Record<string, number> = {
  awaiting_funds: 3_000,
  funds_received: 2_000,
  payment_submitted: 2_000,
};

export const APPROVED_ENDORSEMENTS: Endorsement[] = [
  { name: 'base', status: 'approved' },
  { name: 'sepa', status: 'approved' },
  { name: 'spei', status: 'approved' },
  { name: 'pix', status: 'approved' },
];

/** under_review → approved (or rejected) after a short review window. */
export function scheduleKycDecision(userId: string, outcome: 'approved' | 'rejected' = 'approved'): void {
  const armKey = `kyc:${userId}`;
  if (armed.has(armKey)) return;
  armed.add(armKey);
  setTimeout(() => {
    armed.delete(armKey);
    mutateDB(['customers'], (db) => {
      const customer = db.customers[userId];
      if (!customer || customer.status !== 'under_review') return;
      customer.status = outcome;
      customer.endorsements = outcome === 'approved' ? APPROVED_ENDORSEMENTS : [];
      customer.updated_at = new Date().toISOString();
      logSimulatedEvent({
        category: 'customer',
        type: 'customer.updated.status_transitioned',
        objectId: customer.id,
        objectStatus: outcome,
        payload: customer,
      });
    });
  }, KYC_DECISION_MS);
}

function advanceTransfer(transferId: string, from: TransferState, to: TransferState): void {
  mutateDB(['transfers'], (db) => {
    const transfer = db.transfers.find((t) => t.id === transferId);
    if (!transfer || transfer.state !== from) return; // canceled or already moved
    transfer.state = to;
    transfer.updated_at = new Date().toISOString();
    if (to === 'payment_processed') {
      transfer.receipt = { transaction_hash: generateTxHash() };
    }
    // Every transition is also a (simulated) webhook delivery on the audit trail.
    logSimulatedEvent({
      category: 'transfer',
      type: 'transfer.updated.status_transitioned',
      objectId: transfer.id,
      objectStatus: to,
      payload: transfer,
    });
    if (to === 'funds_received') {
      // Virtual-account activity: the fiat deposit that funded this transfer.
      settleVirtualDeposits(transfer.id);
    }
    if ((TERMINAL_TRANSFER_STATES as readonly string[]).includes(to)) {
      enqueueTransferEmail(transfer);
    }
  });
}

/** Walks a transfer down the happy path unless it was canceled meanwhile. */
export function scheduleTransferProgression(transferId: string): void {
  const armKey = `transfer:${transferId}`;
  if (armed.has(armKey)) return;
  armed.add(armKey);

  const chain: Array<[TransferState, TransferState]> = [
    ['awaiting_funds', 'funds_received'],
    ['funds_received', 'payment_submitted'],
    ['payment_submitted', 'payment_processed'],
  ];

  let elapsed = 0;
  for (const [from, to] of chain) {
    elapsed += TRANSITION_MS[from] ?? 5_000;
    setTimeout(() => {
      advanceTransfer(transferId, from, to);
      if (to === 'payment_processed') armed.delete(armKey);
    }, elapsed);
  }
}

/**
 * Re-arm timers after a page reload for any resource still mid-flight
 * (timers don't survive reloads, the localStorage state does).
 */
export function resumeMachines(): void {
  const db = loadDB();
  for (const transfer of db.transfers) {
    if (
      !(TERMINAL_TRANSFER_STATES as readonly string[]).includes(transfer.state) &&
      (HAPPY_PATH_STATES as readonly string[]).includes(transfer.state)
    ) {
      scheduleTransferProgression(transfer.id);
    }
  }
  for (const [userId, customer] of Object.entries(db.customers)) {
    if (customer.status === 'under_review') scheduleKycDecision(userId);
  }
}
