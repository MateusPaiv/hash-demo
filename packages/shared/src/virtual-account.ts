/**
 * Bridge API (v0) — Virtual Accounts.
 *
 * Bridge-hosted receiving accounts. Fiat sent to these deposit instructions
 * is converted and delivered per the account's destination configuration.
 */

import type { FiatCurrency } from './external-account';

export type VirtualAccountStatus = 'active' | 'pending' | 'deactivated';

/** Receiving bank details shown to the user for fiat deposits. */
export interface VirtualAccountDepositInstructions {
  bank_name: string;
  /** USD (ACH/Wire) */
  routing_number?: string;
  account_number?: string;
  /** EUR (SEPA) */
  iban?: string;
  bic?: string;
  /** MXN (SPEI) */
  clabe?: string;
  /** BRL (Pix) */
  pix_key?: string;
}

export interface VirtualAccount {
  id: string;
  customer_id: string;
  currency: FiatCurrency;
  status: VirtualAccountStatus;
  deposit_instructions: VirtualAccountDepositInstructions;
  created_at: string;
}
