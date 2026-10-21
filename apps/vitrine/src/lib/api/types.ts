/**
 * Request/response DTOs for the API facade.
 * These mirror the future Cofre REST contract (docs/cofre-contract.md).
 */
import type { Currency, PixKeyType } from '@hash/shared';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
}

export interface SignUpInput {
  full_name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type CreateExternalAccountInput =
  | {
      rail: 'ach';
      bank_name: string;
      account_holder_name: string;
      routing_number: string;
      account_number: string;
      account_subtype: 'checking' | 'savings';
    }
  | {
      rail: 'wire';
      bank_name: string;
      account_holder_name: string;
      routing_number: string;
      account_number: string;
    }
  | {
      rail: 'iban';
      bank_name: string;
      account_holder_name: string;
      iban: string;
      bic: string;
    }
  | {
      rail: 'clabe';
      bank_name: string;
      account_holder_name: string;
      clabe: string;
    }
  | {
      rail: 'pix';
      bank_name?: string;
      account_holder_name: string;
      pix_key: string;
      pix_key_type: PixKeyType;
    }
  | {
      rail: 'faster_payments';
      bank_name: string;
      account_holder_name: string;
      sort_code: string;
      account_number: string;
    }
  | {
      rail: 'bank_transfer_co';
      bank_name: string;
      account_holder_name: string;
      account_number: string;
      account_subtype: 'checking' | 'savings';
    };

export interface CreateTransferInput {
  /** Decimal string in source currency. */
  amount: string;
  source_currency: Currency;
  destination_currency: Currency;
  /** Crypto → fiat: which bank receives the payout. */
  destination_external_account_id?: string;
  /** Fiat → crypto: which wallet receives USDC on Base. */
  destination_wallet_address?: string;
  /** Platform take-rate, e.g. "1.0". */
  developer_fee_percent: string;
  /**
   * Client-generated UUID (crypto.randomUUID). The (future) Cofre stores it
   * for 24h and forwards it to Bridge as the `Idempotency-Key` header, so
   * double-clicks can never create duplicate transfers.
   */
  idempotency_key: string;
}
