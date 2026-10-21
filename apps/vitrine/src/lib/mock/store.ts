/**
 * Mock persistence layer — stands in for Supabase Postgres.
 *
 * The entire "database" lives in localStorage so demo state survives reloads.
 * Every mutation publishes the affected tables, which is what the mock
 * realtime hub uses to simulate Supabase Realtime broadcasts.
 *
 * IMPORTANT: nothing in here may touch `window` during server prerender —
 * all access is guarded and effectively browser-only.
 */
import type {
  Customer,
  ExternalAccount,
  FiatCurrency,
  Transfer,
  VirtualAccount,
} from '@hash/shared';

export interface MockUser {
  id: string;
  email: string;
  /** Plaintext ONLY because this is a local demo mock — never do this for real. */
  password: string;
  full_name: string;
  created_at: string;
}

export interface MockSession {
  user_id: string;
  issued_at: string;
}

/** Mirrors the future `idempotency_keys` table (24h TTL). */
export interface IdempotencyRecord {
  key: string;
  user_id: string;
  endpoint: string;
  /** Canonical request body. A reused key with a different hash is a 409. */
  request_hash?: string;
  resource_id: string;
  created_at: string;
  expires_at: string;
}

/** Mirrors the future `webhook_events` table (Cofre-internal audit trail). */
export interface WebhookEventRow {
  event_id: string;
  event_category: string;
  event_type: string;
  event_object_id: string;
  event_object_status?: string;
  /** Full event envelope snapshot, as delivered. */
  payload: unknown;
  received_at: string;
  processed_at: string | null;
  /** The demo signals whether a live receiver handled it or it was simulated. */
  delivery: 'live' | 'simulated';
  /** Signature verification verdict — false only in the simulated path. */
  verified: boolean;
}

/** Mirrors the future Resend-backed notifications (phase 2, mocked pipeline). */
export interface EmailOutboxRow {
  id: string;
  to: string;
  template: 'transfer.completed' | 'transfer.canceled' | 'transfer.refunded';
  subject: string;
  payload: Record<string, string>;
  status: 'queued' | 'sent' | 'failed';
  created_at: string;
}

/** Mirrors the virtual-account deposit ledger (GET …/virtual_accounts/{id}/history). */
export interface VirtualActivityRow {
  id: string;
  customer_id: string;
  currency: FiatCurrency;
  /** Deposit amount, decimal string in the VA currency. */
  amount: string;
  status: 'pending' | 'received';
  /** The transfer this deposit funds, when it exists. */
  transfer_id?: string;
  created_at: string;
  settled_at?: string;
}

export interface MockDB {
  users: MockUser[];
  session: MockSession | null;
  /** Backoffice session lives here so it syncs across tabs like everything else. */
  admin_session: boolean;
  /** Platform take-rate (GET/PUT /developer/fees contract), e.g. "1.0". */
  platform_fee_percent: string;
  /** Bridge customer per user (1:1 for the MVP). */
  customers: Record<string, Customer>;
  external_accounts: ExternalAccount[];
  virtual_accounts: VirtualAccount[];
  virtual_activity: VirtualActivityRow[];
  transfers: Transfer[];
  idempotency_keys: IdempotencyRecord[];
  webhook_events: WebhookEventRow[];
  email_outbox: EmailOutboxRow[];
}

export type MockTable =
  | 'customers'
  | 'external_accounts'
  | 'virtual_accounts'
  | 'virtual_activity'
  | 'transfers'
  | 'session'
  | 'admin'
  | 'config'
  | 'webhook_events'
  | 'email_outbox';

const STORAGE_KEY = 'hash_mock_db_v1';

const EMPTY_DB: MockDB = {
  users: [],
  session: null,
  admin_session: false,
  platform_fee_percent: '1.0',
  customers: {},
  external_accounts: [],
  virtual_accounts: [],
  virtual_activity: [],
  transfers: [],
  idempotency_keys: [],
  webhook_events: [],
  email_outbox: [],
};

let cache: MockDB | null = null;

type Listener = (table: MockTable) => void;
const listeners = new Set<Listener>();
const externalSyncHandlers = new Set<() => void>();

const ALL_TABLES: MockTable[] = [
  'customers',
  'external_accounts',
  'virtual_accounts',
  'virtual_activity',
  'transfers',
  'session',
  'admin',
  'config',
  'webhook_events',
  'email_outbox',
];

/** Other browser tabs write the same localStorage key. Re-read and rebroadcast. */
function installStorageSync(): void {
  if (typeof window === 'undefined') return;
  const flag = globalThis as { __hashStorageSync?: boolean };
  if (flag.__hashStorageSync) return;
  flag.__hashStorageSync = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.newValue == null) return;
    try {
      cache = { ...structuredClone(EMPTY_DB), ...JSON.parse(event.newValue) };
    } catch {
      return;
    }
    for (const table of ALL_TABLES) {
      for (const listener of listeners) listener(table);
    }
    for (const handler of externalSyncHandlers) handler();
  });
}

installStorageSync();

/** Runs after another tab syncs the mock DB (used to re-arm webhook timers). */
export function onExternalSync(handler: () => void): () => void {
  externalSyncHandlers.add(handler);
  return () => {
    externalSyncHandlers.delete(handler);
  };
}

export function loadDB(): MockDB {
  if (cache) return cache;
  if (typeof window === 'undefined') return structuredClone(EMPTY_DB);
  let db: MockDB;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    db = raw ? { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) } : structuredClone(EMPTY_DB);
  } catch {
    db = structuredClone(EMPTY_DB);
  }
  cache = db;
  return db;
}

function saveDB(db: MockDB): void {
  cache = db;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

/** Apply a mutation and notify subscribers of the touched tables. */
export function mutateDB(tables: MockTable[], mutate: (db: MockDB) => void): void {
  const db = loadDB();
  mutate(db);
  saveDB(db);
  for (const table of tables) {
    for (const listener of listeners) listener(table);
  }
}

export function subscribeDB(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Synchronous session read for hooks/guards (browser-only in practice). */
export function getSessionUser(): MockUser | null {
  const db = loadDB();
  if (!db.session) return null;
  return db.users.find((u) => u.id === db.session!.user_id) ?? null;
}

/** Separate backoffice session flag (ops console ≠ client app). */
export function isAdminSession(): boolean {
  return loadDB().admin_session;
}

export function setAdminSession(active: boolean): void {
  mutateDB(['admin'], (db) => {
    db.admin_session = active;
  });
}
