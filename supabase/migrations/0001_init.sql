-- ============================================================================
-- Hash — Cofre foundation schema (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- NOT executed by the demo. This migration is the production blueprint the
-- Backend Vault (Cofre) will run against Supabase. Design rules:
--   * Users read their own rows via RLS; all writes happen through the Cofre
--     with the service-role key (RLS bypass), never from the frontend.
--   * `idempotency_keys` and `webhook_events` are Cofre-internal: no client
--     access at all (no policies → denied by default under RLS).
--   * UI-facing tables join the realtime publication so webhook-driven
--     updates reach the Vitrine instantly.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- Enums -----------------------------------------------------------

create type customer_status as enum (
  'not_started', 'incomplete', 'under_review', 'approved', 'rejected'
);

create type endorsement_name as enum (
  'base', 'sepa', 'spei', 'pix', 'cop', 'faster_payments'
);

create type endorsement_status as enum (
  'pending', 'approved', 'rejected', 'incomplete'
);

-- All 11 canonical Bridge transfer states. Cancellation is only valid from
-- 'awaiting_funds' (enforced again by Bridge on DELETE /v0/transfers/{id}).
create type transfer_state as enum (
  'awaiting_funds', 'in_review', 'funds_received', 'payment_submitted',
  'payment_processed', 'canceled', 'undeliverable', 'returned',
  'refund_in_flight', 'refund_failed', 'refunded'
);

create type external_account_rail as enum ('ach', 'wire', 'iban', 'clabe', 'pix');

create type fiat_currency as enum ('usd', 'eur', 'mxn', 'brl');

create type account_status as enum ('active', 'pending', 'deactivated');

-- ---------- updated_at trigger ----------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles --------------------------------------------------------

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: read own"
  on profiles for select
  using (auth.uid() = id);

-- ---------- bridge_customers ------------------------------------------------

create table bridge_customers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references profiles (id) on delete cascade,
  bridge_customer_id  text unique,                -- assigned by Bridge (customer.created)
  status              customer_status not null default 'not_started',
  endorsements        jsonb not null default '[]', -- Endorsement[] from @hash/shared
  kyc_link            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger bridge_customers_updated_at
  before update on bridge_customers
  for each row execute function set_updated_at();

alter table bridge_customers enable row level security;

create policy "bridge_customers: read own"
  on bridge_customers for select
  using (auth.uid() = user_id);

-- ---------- external_accounts -----------------------------------------------

create table external_accounts (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references bridge_customers (id) on delete cascade,
  bridge_account_id   text unique,                -- assigned by Bridge
  currency            fiat_currency not null,
  rail                external_account_rail not null,
  bank_name           text not null,
  account_holder_name text not null,
  -- Rail-specific secrets (routing/account, IBAN/BIC, CLABE, Pix key).
  -- Read back ONLY by the Cofre; the Vitrine receives masked projections.
  details             jsonb not null,
  status              account_status not null default 'pending',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger external_accounts_updated_at
  before update on external_accounts
  for each row execute function set_updated_at();

alter table external_accounts enable row level security;

create policy "external_accounts: read own"
  on external_accounts for select
  using (
    customer_id in (
      select id from bridge_customers where user_id = auth.uid()
    )
  );

-- ---------- virtual_accounts -------------------------------------------------

create table virtual_accounts (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references bridge_customers (id) on delete cascade,
  bridge_virtual_account_id text unique,
  currency              fiat_currency not null,
  deposit_instructions  jsonb not null, -- routing/IBAN/CLABE/Pix receiving details
  status                account_status not null default 'pending',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger virtual_accounts_updated_at
  before update on virtual_accounts
  for each row execute function set_updated_at();

alter table virtual_accounts enable row level security;

create policy "virtual_accounts: read own"
  on virtual_accounts for select
  using (
    customer_id in (
      select id from bridge_customers where user_id = auth.uid()
    )
  );

-- ---------- transfers ---------------------------------------------------------

create table transfers (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references bridge_customers (id) on delete cascade,
  bridge_transfer_id  text unique,                -- assigned by Bridge
  client_reference_id text,                       -- mirrors the idempotency key
  state               transfer_state not null default 'awaiting_funds',
  amount              numeric(20, 6) not null check (amount > 0),
  developer_fee       numeric(20, 6) not null default 0,
  source              jsonb not null,             -- TransferEnd from @hash/shared
  destination         jsonb not null,
  receipt             jsonb,                      -- tx hash / trace number when final
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index transfers_customer_created_idx
  on transfers (customer_id, created_at desc);

create trigger transfers_updated_at
  before update on transfers
  for each row execute function set_updated_at();

alter table transfers enable row level security;

create policy "transfers: read own"
  on transfers for select
  using (
    customer_id in (
      select id from bridge_customers where user_id = auth.uid()
    )
  );

-- ---------- idempotency_keys (Cofre-internal) ---------------------------------
-- Every POST the Cofre proxies to Bridge is wrapped with one of these keys.
-- Bridge honors Idempotency-Key for 24h; we persist the mapping so retries
-- (double-clicks, network flaps) return the original response.

create table idempotency_keys (
  key          uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null,                     -- e.g. 'POST /v1/transfers'
  request_hash text not null,                     -- sha256 of the request body
  resource_id  text,                              -- created resource (transfer id, …)
  response     jsonb,                             -- cached response for safe replays
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours'
);

create index idempotency_keys_expiry_idx on idempotency_keys (expires_at);

alter table idempotency_keys enable row level security;
-- No policies: only the Cofre (service role) may read/write this table.

-- ---------- webhook_events (Cofre-internal) -----------------------------------
-- Raw audit log + dedupe store for Bridge deliveries. `event_id` is the
-- primary dedupe key; `event_sequence` restores ordering per endpoint.

create table webhook_events (
  event_id         text primary key,
  event_category   text not null, -- customer | kyc_link | transfer | virtual_account.activity | external_account
  event_type       text not null,
  event_object_id  text,
  event_sequence   bigint,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);

create index webhook_events_category_idx on webhook_events (event_category, received_at desc);

alter table webhook_events enable row level security;
-- No policies: only the Cofre (service role) may read/write this table.

-- ---------- realtime publication ----------------------------------------------
-- Webhook-driven writes to these tables broadcast to the Vitrine instantly.

alter publication supabase_realtime add table bridge_customers;
alter publication supabase_realtime add table external_accounts;
alter publication supabase_realtime add table virtual_accounts;
alter publication supabase_realtime add table transfers;
