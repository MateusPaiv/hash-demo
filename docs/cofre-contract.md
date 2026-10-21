# Cofre Contract — Backend Vault Specification

Status: **specification (not yet deployed)**. The Vitrine currently fulfills this
exact surface through `apps/vitrine/src/lib/api/client.ts` (mock engine). When
the Cofre ships, only that module's internals change.

## 1. Topology & non-negotiables

```
┌──────────────┐   HTTPS (JSON)    ┌───────────────┐   Api-Key + Idempotency-Key   ┌────────────┐
│   VITRINE    │ ────────────────▶ │     COFRE     │ ─────────────────────────────▶ │  Bridge    │
│  (Next.js)   │ ◀──────────────── │  (Node/TS)    │                                │ api.bridge │
└──────────────┘                   └──────┬────────┘ ◀── signed webhooks ────────── │  .xyz/v0   │
       ▲ Supabase Realtime                │ service-role writes                     └────────────┘
       └──────────────────────────────────┴────────────▶ Supabase (Postgres/Auth/Realtime)
```

1. The Bridge `Api-Key` exists **only** in the Cofre's environment. It is never
   shipped to the browser, never in `NEXT_PUBLIC_*`, never logged.
2. Every `POST` the Cofre proxies to Bridge carries an `Idempotency-Key`
   (UUID, 24h validity) that is stored in `idempotency_keys` first.
3. All database writes flow through the Cofre (service role). The Vitrine has
   read-only RLS access to its own rows and subscribes via Supabase Realtime.
4. Webhook processing is verify-first, dedupe-always, acknowledge-fast.

## 2. Environment

| Variable | Scope | Notes |
|---|---|---|
| `BRIDGE_API_KEY` | Cofre | Sent as `Api-Key` header. Shown once by Bridge at creation. |
| `BRIDGE_WEBHOOK_PUBLIC_KEY` | Cofre | PEM, per-endpoint, issued when the webhook is created. |
| `BRIDGE_BASE_URL` | Cofre | `https://api.bridge.xyz/v0` (sandbox toggle for dev). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Cofre | Service role bypasses RLS; server-only. |
| `DEVELOPER_FEE_PERCENT` | Cofre | e.g. `1.0`; forwarded to Bridge as `developer_fee_percent`. |
| `RESEND_API_KEY` | Cofre | Phase 2 — transactional emails. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vitrine | Auth + Realtime only. |

## 3. REST surface (mirrors `client.ts` 1:1)

| Facade method | Cofre route | Upstream Bridge call |
|---|---|---|
| `kyc.createLink` | `POST /v1/kyc-links` | `POST /kyc_links` |
| `customer.me` | `GET /v1/customers/me` | `GET /customers/{id}` (reconciled by webhooks) |
| `externalAccounts.list` | `GET /v1/external-accounts` | DB read (masked projection) |
| `externalAccounts.create` | `POST /v1/external-accounts` | `POST /customers/{id}/external_accounts` |
| `externalAccounts.remove` | `DELETE /v1/external-accounts/{id}` | `DELETE /external_accounts/{id}` |
| `virtualAccounts.mine` | `GET /v1/virtual-accounts` | `GET/POST /customers/{id}/virtual_accounts` |
| `rates.get` | `GET /v1/exchange-rates?from&to` | `GET /exchange_rates` |
| `transfers.create` | `POST /v1/transfers` | `POST /transfers` |
| `transfers.list` | `GET /v1/transfers` | DB read |
| `transfers.cancel` | `DELETE /v1/transfers/{id}` | `DELETE /transfers/{id}` — Bridge rejects unless `awaiting_funds` |

**Errors:** JSON `{ "error": { "message": string, "code": string } }` with
statuses `400/401/403/404/409/422`. The Vitrine's `ApiError` already models it.

## 4. Idempotency (all proxied POSTs)

1. Client generates a UUID per *intent* (`crypto.randomUUID()` — already done
   in the swap widget) and sends it as `Idempotency-Key`.
2. Cofre: `INSERT INTO idempotency_keys (key, …)` — on primary-key conflict,
   return the stored `response` (HTTP 200, header `X-Idempotent-Replay: true`)
   instead of re-calling Bridge.
3. Keys expire after 24h (`expires_at`, pruned opportunistically) — matching
   Bridge's idempotency window.
4. Store `request_hash`; a conflicting body under the same key → `409`.

## 5. Webhook receiver — `POST /webhooks/bridge`

### 5.1 Signature verification (MANDATORY, before any parsing side effects)

Header: `X-Webhook-Signature: t=<timestamp_ms>,v0=<base64_signature>`

1. Parse `t` and `v0`. Reject `400` if either is missing.
2. **Replay window:** reject `400` when `|now − t| > 10 minutes` (Bridge retries).
3. Compute digest = `SHA256(SHA256("<t>.<raw_body>"))` — **Bridge hashes twice.**
   Pass the *digest* to `crypto.verify` (Node/Python/Ruby hash again internally);
   feeding the raw string always fails verification.
4. Verify the strict-base64-decoded `v0` signature over that digest with the
   per-endpoint PEM public key. Failure → `400`.
5. The handler must read the **raw body** (no JSON middleware before verify).

### 5.2 Processing pipeline

1. `INSERT INTO webhook_events (event_id, …) ON CONFLICT DO NOTHING` — a
   conflicting `event_id` means duplicate delivery: return `200` immediately.
2. Return `200` fast; process asynchronously (queue/background task).
3. Apply by `event_category`, using `event_sequence` for ordering:

| Category | Effect |
|---|---|
| `customer` | Upsert `bridge_customers` (status, endorsements, `bridge_customer_id`). |
| `kyc_link` | Track KYC link lifecycle on `bridge_customers.kyc_link`. |
| `transfer` | Upsert `transfers` (state, receipt). On `payment_processed`/`refunded`/`canceled` → Resend email (phase 2). |
| `virtual_account.activity` | Record fiat deposit; auto-advance related transfer when funded. |
| `external_account` | Upsert `external_accounts.status`. |

4. Set `processed_at`. Realtime broadcasts fire automatically on write.

### 5.3 Provisioning

Webhook endpoints start `disabled`; test with
`POST /v0/webhooks/{id}/send`, inspect `/logs`, then enable with
`PUT /v0/webhooks/{id}` (`active`). Max 5 endpoints.

## 6. Mock → real swap map (Vitrine)

| Mock piece | Production replacement |
|---|---|
| `lib/mock/store.ts` (localStorage) | Supabase Postgres |
| `lib/mock/realtime.ts` (`subscribeTable`) | `supabase.channel().on('postgres_changes', …)` |
| `lib/mock/machines.ts` (timers) | Bridge webhooks → Cofre → Postgres |
| `client.auth.*` | `supabase.auth.*` (email + password) |
| `client.*` bodies | `fetch('https://<cofre>/v1/…')` with the same DTOs |
