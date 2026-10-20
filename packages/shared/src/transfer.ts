/**
 * Bridge API (v0) — Transfers.
 *
 * The 11 canonical transfer states. Happy path is strictly forward:
 *   awaiting_funds → funds_received → payment_submitted → payment_processed
 * Everything else is an exception/terminal path. Cancellation is only
 * possible from `awaiting_funds` (DELETE /v0/transfers/{transferID}).
 */

import type { FiatCurrency } from './external-account';

export type TransferState =
  | 'awaiting_funds'
  | 'in_review'
  | 'funds_received'
  | 'payment_submitted'
  | 'payment_processed'
  | 'canceled'
  | 'undeliverable'
  | 'returned'
  | 'refund_in_flight'
  | 'refund_failed'
  | 'refunded';

/** States after which no further transitions occur. */
export const TERMINAL_TRANSFER_STATES: readonly TransferState[] = [
  'payment_processed',
  'canceled',
  'undeliverable',
  'refunded',
] as const;

/** States from which the developer may cancel the transfer. */
export const CANCELLABLE_TRANSFER_STATES: readonly TransferState[] = [
  'awaiting_funds',
] as const;

/** Ordered happy-path states (used by the UI status timeline). */
export const HAPPY_PATH_STATES: readonly TransferState[] = [
  'awaiting_funds',
  'funds_received',
  'payment_submitted',
  'payment_processed',
] as const;

export function isTerminalState(state: TransferState): boolean {
  return TERMINAL_TRANSFER_STATES.includes(state);
}

export function isCancellable(state: TransferState): boolean {
  return CANCELLABLE_TRANSFER_STATES.includes(state);
}

export type CryptoCurrency = 'usdc';

export type Currency = FiatCurrency | CryptoCurrency;

/** One end of a transfer. `payment_rail` is e.g. ach/wire/sepa/spei/pix or a chain (base). */
export interface TransferEnd {
  payment_rail: string;
  currency: Currency;
  /** Fiat destination: the customer's external account. */
  external_account_id?: string;
  /** Crypto destination: wallet address + chain. */
  wallet_address?: string;
  chain?: 'base';
}

export interface TransferReceipt {
  /** Final on-chain hash (only trustworthy from `payment_processed`). */
  transaction_hash?: string;
  /** Wire IMAD / ACH trace number, when available. */
  trace_number?: string;
}

export interface Transfer {
  id: string;
  /** Developer-supplied reference; mirrors our idempotency record. */
  client_reference_id: string;
  /** Bridge customer the transfer is executed for. */
  on_behalf_of: string;
  state: TransferState;
  /** Decimal string in source currency, e.g. "500.25". */
  amount: string;
  /** Decimal string in source currency — our platform's take. */
  developer_fee: string;
  source: TransferEnd;
  destination: TransferEnd;
  receipt?: TransferReceipt;
  created_at: string;
  updated_at: string;
}
