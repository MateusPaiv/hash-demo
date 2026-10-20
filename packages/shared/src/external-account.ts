/**
 * Bridge API (v0) — External Accounts.
 *
 * A customer's off-platform bank account, used as a transfer destination
 * (off-ramp) or source. Modeled as a discriminated union on `rail` so the
 * dynamic "Add Bank" form and the future Cofre share one source of truth.
 */

export type FiatCurrency = 'usd' | 'eur' | 'mxn' | 'brl';

export type ExternalAccountRail = 'ach' | 'wire' | 'iban' | 'clabe' | 'pix';

export type ExternalAccountStatus = 'active' | 'pending' | 'deactivated';

interface ExternalAccountBase {
  id: string;
  customer_id: string;
  currency: FiatCurrency;
  rail: ExternalAccountRail;
  bank_name: string;
  account_holder_name: string;
  status: ExternalAccountStatus;
  created_at: string;
}

/** USD — ACH credit. */
export interface AchExternalAccount extends ExternalAccountBase {
  rail: 'ach';
  currency: 'usd';
  routing_number: string;
  account_number: string;
  account_subtype: 'checking' | 'savings';
}

/** USD — domestic wire. */
export interface WireExternalAccount extends ExternalAccountBase {
  rail: 'wire';
  currency: 'usd';
  routing_number: string;
  account_number: string;
}

/** EUR — SEPA via IBAN/BIC. */
export interface IbanExternalAccount extends ExternalAccountBase {
  rail: 'iban';
  currency: 'eur';
  iban: string;
  bic: string;
}

/** MXN — SPEI via 18-digit CLABE. */
export interface ClabeExternalAccount extends ExternalAccountBase {
  rail: 'clabe';
  currency: 'mxn';
  clabe: string;
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp';

/** BRL — Pix key (CPF/CNPJ/email/phone/EVP). */
export interface PixExternalAccount extends ExternalAccountBase {
  rail: 'pix';
  currency: 'brl';
  pix_key: string;
  pix_key_type: PixKeyType;
}

export type ExternalAccount =
  | AchExternalAccount
  | WireExternalAccount
  | IbanExternalAccount
  | ClabeExternalAccount
  | PixExternalAccount;
