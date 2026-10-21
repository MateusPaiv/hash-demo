/**
 * THE API FACADE — the only module UI code talks to.
 *
 * Today every method is fulfilled by the mock engine (localStorage + timers).
 * The method surface mirrors the future Cofre REST API 1:1, so going live
 * means re-implementing these bodies as `fetch('https://cofre.../v1/...')`
 * calls — components, hooks, and types do not change.
 *
 * Note: the Bridge Api-Key never exists anywhere near this codebase. In
 * production it lives exclusively in the Cofre's environment.
 */
import type {
  Customer,
  ExchangeRate,
  ExternalAccount,
  FiatCurrency,
  Transfer,
  VirtualAccount,
} from '@hash/shared';
import { delay } from '@/lib/mock/latency';
import { loadDB, mutateDB, onExternalSync, type MockDB, type MockUser, type VirtualActivityRow } from '@/lib/mock/store';
import {
  generateAccountNumber,
  newId,
  quotedRates,
  railForFiat,
} from '@/lib/mock/fixtures';
import { resumeMachines, scheduleKycDecision, scheduleTransferProgression } from '@/lib/mock/machines';
import { enqueueTransferEmail, logSimulatedEvent, recordVirtualDeposit } from '@/lib/mock/events';
import { isFiat } from '@/lib/constants';
import type {
  AuthUser,
  CreateExternalAccountInput,
  CreateTransferInput,
  SignInInput,
  SignUpInput,
} from './types';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h, like Bridge

/** Which endorsement unlocks a fiat currency (rails granted per customer in Bridge). */
export const CURRENCY_ENDORSEMENT: Record<string, string> = {
  usd: 'base',
  eur: 'sepa',
  gbp: 'faster_payments',
  mxn: 'spei',
  brl: 'pix',
  cop: 'cop',
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function toAuthUser(user: MockUser): AuthUser {
  return { id: user.id, email: user.email, full_name: user.full_name };
}

function requireSession(db: MockDB): MockUser {
  if (!db.session) throw new ApiError('Not authenticated', 401);
  const user = db.users.find((u) => u.id === db.session!.user_id);
  if (!user) throw new ApiError('Not authenticated', 401);
  return user;
}

function requireCustomer(db: MockDB, user: MockUser): Customer {
  const customer = db.customers[user.id];
  if (!customer) throw new ApiError('Customer profile not found', 404);
  return customer;
}

function railFor(currency: CreateTransferInput['source_currency']): string {
  return isFiat(currency) ? railForFiat(currency) : 'base';
}

/** Re-arm simulated webhook timers after a reload. UI calls this — never `lib/mock`. */
export function resumeSimulatedWebhooks(): void {
  resumeMachines();
}

if (typeof window !== 'undefined') {
  onExternalSync(() => resumeMachines());
}

function transferRequestHash(input: CreateTransferInput): string {
  return JSON.stringify({
    amount: Number(input.amount).toFixed(2),
    source_currency: input.source_currency,
    destination_currency: input.destination_currency,
    destination_external_account_id: input.destination_external_account_id ?? null,
    destination_wallet_address: input.destination_wallet_address ?? null,
    developer_fee_percent: input.developer_fee_percent,
  });
}

export const client = {
  auth: {
    async signUp(input: SignUpInput): Promise<{ user: AuthUser }> {
      await delay();
      const db = loadDB();
      const email = input.email.trim().toLowerCase();
      if (db.users.some((u) => u.email === email)) {
        throw new ApiError('An account with this email already exists', 409);
      }
      const user: MockUser = {
        id: newId('user'),
        email,
        password: input.password,
        full_name: input.full_name.trim(),
        created_at: new Date().toISOString(),
      };
      const now = new Date().toISOString();
      mutateDB(['session', 'customers'], (draft) => {
        draft.users.push(user);
        draft.session = { user_id: user.id, issued_at: now };
        draft.customers[user.id] = {
          id: newId('cust'),
          full_name: user.full_name,
          email: user.email,
          status: 'not_started',
          endorsements: [],
          created_at: now,
          updated_at: now,
        };
      });
      return { user: toAuthUser(user) };
    },

    async signIn(input: SignInInput): Promise<{ user: AuthUser }> {
      await delay();
      const db = loadDB();
      const user = db.users.find(
        (u) => u.email === input.email.trim().toLowerCase() && u.password === input.password,
      );
      if (!user) throw new ApiError('Invalid email or password', 401);
      mutateDB(['session'], (draft) => {
        draft.session = { user_id: user.id, issued_at: new Date().toISOString() };
      });
      return { user: toAuthUser(user) };
    },

    async signOut(): Promise<void> {
      await delay(150);
      mutateDB(['session'], (draft) => {
        draft.session = null;
      });
    },

    async getSession(): Promise<{ user: AuthUser } | null> {
      await delay(50);
      const db = loadDB();
      if (!db.session) return null;
      const user = db.users.find((u) => u.id === db.session!.user_id);
      return user ? { user: toAuthUser(user) } : null;
    },
  },

  customer: {
    /** GET /v1/customers/me */
    async me(): Promise<Customer> {
      await delay(150);
      const db = loadDB();
      return requireCustomer(db, requireSession(db));
    },
  },

  kyc: {
    /**
     * POST /v1/kyc-links → Bridge POST /kyc_links.
     * Returns the hosted KYC URL the user completes in a separate tab.
     */
    async createLink(): Promise<{ url: string }> {
      await delay();
      const db = loadDB();
      const user = requireSession(db);
      const customer = requireCustomer(db, user);
      if (customer.status === 'under_review') {
        throw new ApiError('A verification is already in review', 409);
      }
      if (customer.status === 'approved') {
        throw new ApiError('Identity already verified', 409);
      }
      const url = '/kyc-simulator';
      mutateDB(['customers'], (draft) => {
        draft.customers[user.id].kyc_link = url;
        draft.customers[user.id].updated_at = new Date().toISOString();
      });
      return { url };
    },

    /**
     * Called by the (simulated) hosted KYC page on completion. In production
     * this transition arrives as a `kyc_link` / `customer` webhook instead.
     */
    async completeHostedSession(outcome: 'approved' | 'rejected'): Promise<void> {
      await delay(400);
      const db = loadDB();
      const user = requireSession(db);
      mutateDB(['customers'], (draft) => {
        const customer = draft.customers[user.id];
        customer.status = 'under_review';
        customer.updated_at = new Date().toISOString();
      });
      scheduleKycDecision(user.id, outcome);
    },
  },

  externalAccounts: {
    /** GET /v1/external-accounts */
    async list(): Promise<ExternalAccount[]> {
      await delay(200);
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      return db.external_accounts.filter((a) => a.customer_id === customer.id);
    },

    /** POST /v1/external-accounts → Bridge POST /customers/{id}/external_accounts */
    async create(input: CreateExternalAccountInput): Promise<ExternalAccount> {
      await delay();
      const db = loadDB();
      const user = requireSession(db);
      const customer = requireCustomer(db, user);
      const now = new Date().toISOString();
      const base = {
        id: newId('ea'),
        customer_id: customer.id,
        bank_name: input.bank_name?.trim() || 'Pix Institution (Mock)',
        account_holder_name: input.account_holder_name.trim(),
        status: 'active' as const,
        created_at: now,
      };
      let account: ExternalAccount;
      switch (input.rail) {
        case 'ach':
          account = { ...base, rail: 'ach', currency: 'usd', routing_number: input.routing_number, account_number: input.account_number, account_subtype: input.account_subtype };
          break;
        case 'wire':
          account = { ...base, rail: 'wire', currency: 'usd', routing_number: input.routing_number, account_number: input.account_number };
          break;
        case 'iban':
          account = { ...base, rail: 'iban', currency: 'eur', iban: input.iban.replace(/\s/g, '').toUpperCase(), bic: input.bic.toUpperCase() };
          break;
        case 'clabe':
          account = { ...base, rail: 'clabe', currency: 'mxn', clabe: input.clabe };
          break;
        case 'pix':
          account = { ...base, rail: 'pix', currency: 'brl', pix_key: input.pix_key.trim(), pix_key_type: input.pix_key_type };
          break;
        case 'faster_payments':
          account = { ...base, rail: 'faster_payments', currency: 'gbp', sort_code: input.sort_code, account_number: input.account_number };
          break;
        case 'bank_transfer_co':
          account = { ...base, rail: 'bank_transfer_co', currency: 'cop', bank_name: input.bank_name, account_number: input.account_number, account_subtype: input.account_subtype };
          break;
      }
      mutateDB(['external_accounts'], (draft) => {
        draft.external_accounts.push(account);
      });
      return account;
    },

    /**
     * DELETE is a later-phase action in the product scope; client-facing
     * lifecycle is deactivate → reactivate (POST …/{id}/deactivate etc.).
     */
    async deactivate(id: string): Promise<void> {
      await delay();
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      const account = db.external_accounts.find((a) => a.id === id && a.customer_id === customer.id);
      if (!account) throw new ApiError('Bank account not found', 404);
      mutateDB(['external_accounts'], (draft) => {
        const a = draft.external_accounts.find((x) => x.id === id)!;
        a.status = 'deactivated';
      });
    },

    async reactivate(id: string): Promise<void> {
      await delay();
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      const account = db.external_accounts.find((a) => a.id === id && a.customer_id === customer.id);
      if (!account) throw new ApiError('Bank account not found', 404);
      mutateDB(['external_accounts'], (draft) => {
        const a = draft.external_accounts.find((x) => x.id === id)!;
        a.status = 'active';
      });
    },
  },

  virtualAccounts: {
    /**
     * GET /v1/virtual-accounts — lazily provisions a mock receiving account
     * once KYC is approved AND the currency's endorsement is active (a Pix
     * virtual account cannot exist without the pix endorsement, etc.).
     */
    async mine(currency: FiatCurrency = 'usd'): Promise<VirtualAccount[]> {
      await delay(200);
      const db = loadDB();
      const user = requireSession(db);
      const customer = requireCustomer(db, user);
      if (customer.status !== 'approved') return [];
      const needed = CURRENCY_ENDORSEMENT[currency];
      if (!customer.endorsements.some((e) => e.name === needed && e.status === 'approved')) {
        return [];
      }
      const existing = db.virtual_accounts.filter(
        (v) => v.customer_id === customer.id && v.currency === currency,
      );
      if (existing.length > 0) return existing;
      const instructions: VirtualAccount['deposit_instructions'] =
        currency === 'usd'
          ? {
              bank_name: 'Lead Bank (Mock)',
              routing_number: '021000021',
              account_number: generateAccountNumber(),
            }
          : currency === 'eur'
            ? { bank_name: 'Flexbank EU (Mock)', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }
            : currency === 'gbp'
              ? { bank_name: 'Meridian UK (Mock)', account_number: generateAccountNumber().slice(0, 8) }
              : currency === 'mxn'
                ? { bank_name: 'Northline MX (Mock)', clabe: Array.from({ length: 18 }, () => Math.floor(Math.random() * 10)).join('') }
                : currency === 'brl'
                  ? { bank_name: 'Pix Institution (Mock)', pix_key: generateAccountNumber().slice(0, 11) }
                  : { bank_name: 'Andina CO (Mock)', account_number: generateAccountNumber().slice(0, 12) };
      const va: VirtualAccount = {
        id: newId('va'),
        customer_id: customer.id,
        currency,
        status: 'active',
        deposit_instructions: instructions,
        created_at: new Date().toISOString(),
      };
      mutateDB(['virtual_accounts'], (draft) => {
        draft.virtual_accounts.push(va);
      });
      return [va];
    },

    /**
     * GET …/virtual_accounts/{id}/history parity — the deposit ledger of the
     * session customer for one fiat currency (pending + settled).
     */
    async activity(currency: FiatCurrency): Promise<VirtualActivityRow[]> {
      await delay(150);
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      return db.virtual_activity
        .filter((row) => row.customer_id === customer.id && row.currency === currency)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },
  },

  developerFees: {
    /** GET /v1/developer/fees — live-platform take-rate for the Convert widget. */
    async get(): Promise<string> {
      await delay(100);
      return loadDB().platform_fee_percent || '1.0';
    },
  },

  rates: {
    /** GET /v1/exchange-rates?from=&to= → Bridge GET /exchange_rates */
    async get(from: ExchangeRate['from'], to: ExchangeRate['to']): Promise<ExchangeRate> {
      await delay(180);
      const quote = quotedRates(from, to);
      if (quote == null) throw new ApiError(`No rate available for ${from}/${to}`, 404);
      return {
        from,
        to,
        mid_rate: quote.mid.toFixed(6),
        buy_rate: quote.buy.toFixed(6),
        sell_rate: quote.sell.toFixed(6),
        fetched_at: new Date().toISOString(),
      };
    },
  },

  transfers: {
    /**
     * POST /v1/transfers → Bridge POST /transfers.
     * Idempotent on `idempotency_key` for 24h: a retried submission returns
     * the original transfer instead of creating a duplicate.
     */
    async create(input: CreateTransferInput): Promise<{ transfer: Transfer; deduplicated: boolean }> {
      await delay(600);
      const db = loadDB();
      const user = requireSession(db);
      const customer = requireCustomer(db, user);
      if (customer.status !== 'approved') {
        throw new ApiError('Identity verification must be approved before transferring', 403);
      }
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError('Amount must be greater than zero', 422);
      }

      // Idempotency check (prune expired keys first). Same key + same body
      // replays the original transfer; same key + different body is a conflict.
      const now = Date.now();
      const requestHash = transferRequestHash(input);
      const record = db.idempotency_keys.find(
        (k) => k.key === input.idempotency_key && Date.parse(k.expires_at) > now,
      );
      if (record) {
        if (record.request_hash && record.request_hash !== requestHash) {
          // Ops-visible audit: a client retried the same key with a new body.
          logSimulatedEvent({
            category: 'transfer',
            type: 'idempotency.conflict',
            objectId: input.idempotency_key,
            payload: { key: input.idempotency_key, endpoint: record.endpoint },
          });
          throw new ApiError('Idempotency key reused with a different request', 409);
        }
        const existing = db.transfers.find((t) => t.id === record.resource_id);
        if (existing) return { transfer: existing, deduplicated: true };
      }

      // Platform take-rate from GET/PUT /developer/fees (admin-configurable).
      const feePercent = db.platform_fee_percent || input.developer_fee_percent;
      const fee = (amount * (Number(feePercent) / 100)).toFixed(2);
      const created = new Date().toISOString();
      const transfer: Transfer = {
        id: newId('tr'),
        client_reference_id: input.idempotency_key,
        on_behalf_of: customer.id,
        state: 'awaiting_funds',
        amount: amount.toFixed(2),
        developer_fee: fee,
        source: {
          payment_rail: railFor(input.source_currency),
          currency: input.source_currency,
          ...(input.source_currency === 'usdc' ? { chain: 'base' as const } : {}),
        },
        destination: {
          payment_rail: railFor(input.destination_currency),
          currency: input.destination_currency,
          ...(input.destination_currency === 'usdc'
            ? { chain: 'base' as const, wallet_address: input.destination_wallet_address }
            : { external_account_id: input.destination_external_account_id }),
        },
        created_at: created,
        updated_at: created,
      };
      if (isFiat(input.source_currency)) {
        // Virtual-account deposit ledger: a fiat-funded transfer registers as a
        // pending deposit until the funds_received webhook settles it.
        recordVirtualDeposit({
          customer_id: customer.id,
          currency: input.source_currency,
          amount: amount.toFixed(2),
          transfer_id: transfer.id,
        });
      }
      mutateDB(['transfers'], (draft) => {
        draft.transfers.push(transfer);
        draft.idempotency_keys = draft.idempotency_keys.filter(
          (k) => Date.parse(k.expires_at) > now,
        );
        draft.idempotency_keys.push({
          key: input.idempotency_key,
          user_id: user.id,
          endpoint: 'POST /v1/transfers',
          request_hash: requestHash,
          resource_id: transfer.id,
          created_at: created,
          expires_at: new Date(now + IDEMPOTENCY_TTL_MS).toISOString(),
        });
      });
      scheduleTransferProgression(transfer.id);
      return { transfer, deduplicated: false };
    },

    /** GET /v1/transfers */
    async list(): Promise<Transfer[]> {
      await delay(200);
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      return db.transfers
        .filter((t) => t.on_behalf_of === customer.id)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },

    /**
     * DELETE /v1/transfers/{id} → Bridge DELETE /transfers/{id}.
     * Only valid while `awaiting_funds` — enforced identically by Bridge.
     */
    async cancel(id: string): Promise<Transfer> {
      await delay();
      const db = loadDB();
      const customer = requireCustomer(db, requireSession(db));
      const transfer = db.transfers.find((t) => t.id === id);
      if (!transfer || transfer.on_behalf_of !== customer.id) {
        throw new ApiError('Transfer not found', 404);
      }
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
      enqueueTransferEmail(canceled); // canceled is terminal → notification queued
      return { ...canceled };
    },
  },
};
