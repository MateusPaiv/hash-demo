# Definition of Done — MVP Completion Checklist

**Project:** Hash — fiat ⇄ crypto payments (Bridge API v0, 12-week MVP)
**Owner:** PM / Lead QA
**Last updated:** 2026-10-21

---

## 0. QA summary — current verified state

| Layer | Status |
|---|---|
| Frontend (Vitrine, Next.js 16) | **Built & verified** — all 3 flows + overview/KPIs, browser E2E green |
| Backoffice (ops console, mocked) | **Built & verified** — `/admin`: platform KPIs, KYC queue with decisions, transfers monitor with ops-cancel, webhook log with replay, idempotency audit, email outbox |
| Mock engine (stands in for Vault) | **Built & verified** — logic suite green (idempotency, rails, cancel rule, webhook-sim, audit trail, email pipeline) |
| Vault webhook receiver | **Implemented (crypto verified)** — `POST /api/webhooks/bridge` + double-SHA256/Ed25519 verification lib, tamper/stale/missing-header tested; live-Bridge delivery pending real keys |
| Vault (real Node service + Supabase) | **Blueprint only** — `docs/cofre-contract.md` + `supabase/migrations/0001_init.sql` |
| Bridge live integration | **Not started** — no `Api-Key` anywhere (by design until Vault exists) |
| Resend (transactional email) | **Mocked pipeline live** — queue/outbox/backoffice done; HTTP call pending `RESEND_API_KEY` |
| i18n (EN / ES / PT-BR) | **Not started** — all copy is hardcoded EN |
| Git remote | **Missing** — repo initialized + initial commit; no push |

**How to verify any `[ ]` below:**

```bash
npm run typecheck && npm run lint && npm run build   # gates (must exit 0)
npm run verify:mock                                  # 35 logic checks (~25s)
npm run verify:e2e                                   # 19 browser checks (~90s, self-hosted server)
```

> Rule: a check may only be ticked `[x]` when it can be demonstrated by one of
> the harnesses above or by a scripted manual walkthrough. "It looks done" is
> not done.

---

## Sprint 0 — Setup, foundations & shared typings

### Module: Project setup & tooling
- [ ] FE: repo boots from root — `npm install && npm run dev` serves `:3000` (workspaces: `apps/*`, `packages/*`)
- [ ] FE: Next.js 16 App Router + TypeScript strict mode, zero type errors (`npm run typecheck`)
- [ ] FE: Tailwind v4 configured with shadcn/ui (`components.json` present) — neutral theme, CSS variables
- [ ] FE: `lucide-react` used as the only icon library across all screens (no emoji icons, no other packs)
- [ ] FE: design language enforced — white/`neutral-50` backgrounds, `neutral-900` text, `rounded-xl` cards, subtle borders
- [ ] FE: type system applied — Inter (body), Space Grotesk (display), IBM Plex Mono (data); asserted in E2E
- [ ] FE: Next 16 `cacheComponents` clean — zero instant-navigation overlay errors in dev log on every route
- Git:
- [ ] `git init -b main` + staged initial commit: `Initial commit: Project setup` (verify: `git log --oneline`)
- [ ] `git remote add origin <YOUR_REPO_URL>` executed with a real URL
- [ ] `git push -u origin main` succeeds and CI (if added) is green

### Module: Bridge typings (`packages/shared`, single source of truth)
- [ ] `CustomerStatus` = exactly `not_started | incomplete | under_review | approved | rejected` (5)
- [ ] `EndorsementName` = exactly `base | sepa | spei | pix | cop | faster_payments` (6) — incl. COP and Faster Payments as enum members even if flows are deferred
- [ ] `Endorsement` carries per-rail `status` (`pending | approved | rejected | incomplete`)
- [ ] `ExternalAccount` is a discriminated union on `rail`: ACH (routing 9d, account, subtype), Wire, IBAN (iban+bic), CLABE (18d), Pix (key + key type) — 5 rails, 4 fiat currencies
- [ ] `VirtualAccount` carries `deposit_instructions`: routing/account (USD), IBAN/BIC (EUR), CLABE (MXN), Pix key (BRL), bank_name
- [ ] `TransferState` = exactly the 11 canonical states: `awaiting_funds, in_review, funds_received, payment_submitted, payment_processed, canceled, undeliverable, returned, refund_in_flight, refund_failed, refunded`
- [ ] Terminal-state and cancellable-state constants exported (cancel = `awaiting_funds` only) and used by the UI, not re-derived
- [ ] `Transfer` exposes decimal-string `amount`, `developer_fee`, source/destination `TransferEnd` (rail, currency, wallet `chain:'base'` or `external_account_id`), `receipt` (tx hash / trace), `client_reference_id`
- [ ] `BridgeWebhookEvent` envelope: `event_id`, `event_sequence`, `event_category` ∈ {customer, kyc_link, transfer, `virtual_account.activity`, external_account}, `event_object`, `event_object_changes` (before/after pairs)
- [ ] `ExchangeRate` exposes `mid_rate`, `buy_rate`, `sell_rate`, `fetched_at`

---

## Sprint 1 — Auth + Onboarding & KYC (Flow A)

### 1. Frontend / UI / UX
- [ ] `/signup` — email+password creation: name/email/password fields with inline zod errors, show/hide password (Eye toggle), pending `Loader2` state, duplicate-email error surfaced (409)
- [ ] `/login` — wrong credentials → inline alert (401), success routes by KYC status (`approved → /dashboard`, else `/onboarding`)
- [ ] Session guard: unauthenticated visits to `/onboarding` or `/dashboard/*` redirect to `/login`; spinner while session resolves
- [ ] `/onboarding` — `not_started`/`incomplete`: CTA card (ShieldCheck) opens the hosted KYC link in a new tab; pending state disables double-start (409 toast)
- [ ] `/onboarding` — `under_review`: amber card with **Clock** icon + explicit "updates in real time — no need to refresh" copy
- [ ] `/onboarding` — `approved`: green card (BadgeCheck) + `Continue to dashboard`; endorsements grid shows per-rail icons (base→Landmark, sepa→Globe2, spei→Building2, pix→QrCode, cop→Coins, faster_payments→Zap) with green CheckCircle2 for approved, amber Clock pending, red XCircle rejected
- [ ] `/onboarding` — `rejected`: red card (XCircle) with **Try again** restart path
- [ ] Hosted KYC page is clearly marked as simulation (amber "Simulation" badge) and offers approve + reject paths
- [ ] Loading/error states on every screen: spinner while queries resolve, friendly ApiError toasts, empty states where lists can be empty
- [ ] i18n: all onboarding/auth copy available in **EN, ES and PT-BR** with a language switcher ⚠️ *not implemented — copy is hardcoded EN*
- [ ] Visual QA: rounded-xl cards, deep dark text, Lucide icons present at every decision point (no wall-of-text states)

### 2. Backend / API / Vault
- [ ] `client.kyc.createLink` proxies to Bridge `POST /kyc_links` behind the Cofre with an `Idempotency-Key` header ⚠️ *design-only (contract §3) — no live Vault*
- [ ] Api-Key never reachable from the frontend bundle (grep audit: no `Api-Key`, `BRIDGE_API_KEY` in `apps/`)
- [ ] Endpoint store-and-check of idempotency keys in Supabase (`idempotency_keys`, 24h TTL, request-hash conflict → 409) ⚠️ *schema exists; live enforcement pending*
- [ ] Mock parity: `createLink` enforces state machine (409 when under_review/approved); hosted completion transitions `under_review` before decision

### 3. Webhooks & asynchronous logic
- [ ] Real `customer.created/updated` + `kyc_link.*` events update `bridge_customers` and fan out via Supabase Realtime ⚠️ *design-only; simulated by `machines.ts`*
- [ ] Backoffice: KYC review queue available to ops (see Sprint 5) ⚠️ *not built*

---

## Sprint 2 — External accounts / Add Bank (Flow B)

### 1. Frontend / UI / UX
- [ ] Form adapts to the selected rail/currency with zero dead fields:
  - [ ] USD + **ACH**: Routing number (exactly 9 digits), Account number (4–17 digits), Checking/Savings selector
  - [ ] USD + **Wire**: Routing + Account (no subtype)
  - [ ] EUR + **IBAN**: IBAN accepted **with space-separated groups** (normalized on save) + BIC/SWIFT format check
  - [ ] MXN + **CLABE**: exactly 18 digits
  - [ ] BRL + **Pix**: key-type selector (CPF 11d / CNPJ 14d / email / phone / EVP-UUID) with per-type validation; bank name optional with sensible default
- [ ] Per-rail icons in cards and dialogs (Landmark, Globe2, Building2, QrCode); currency badges (USD/EUR/MXN/BRL)
- [ ] Sensitive details **masked** on cards (`••••0021` style); Pix shows type + truncated key
- [ ] Remove account behind a confirm dialog with destructive styling
- [ ] Empty state (Landmark, CTA) and skeleton loading grid while the list resolves
- [ ] Edge coverage from scope: all **5 data-model rails** usable end-to-end in the form; **COP and Faster Payments (GBP)** documented as deferred with a card/notice accounting for the "6 rails" expectation
- [ ] i18n: form labels, validation messages and rail names in EN/ES/PT-BR ⚠️ *not implemented*

### 2. Backend / API / Vault
- [ ] `client.externalAccounts.create` proxies to Bridge `POST /customers/{customerID}/external_accounts` with `Idempotency-Key` ⚠️ *design-only*
- [ ] Mock parity: zod discriminated-union validation rejects bad inputs (verified in logic suite: 9-digit routing, 18d CLABE, CPF length, malformed IBAN) and normalizes (IBAN uppercased/space-stripped)
- [ ] Ownership enforcement: list/remove return only the session user's accounts (RLS read-own once live)

### 3. Webhooks & asynchronous logic
- [ ] `external_account` category events update account `status` (pending→active etc.) and broadcast ⚠️ *design-only; mock rebroadcast verified live*
- [ ] Validation failures surface as field-level errors, never as silent 500s

---

## Sprint 3 — Convert & Transfers (Flow C) + Overview

### 1. Frontend / UI / UX
- [ ] Centered swap widget: "You send" / "You receive" panels with the circular **ArrowDownUp** flip button between them; flip swaps both currencies
- [ ] Currency selectors constrain to exactly one side being USDC (USD/EUR/MXN/BRL/USDC both directions: fiat→crypto and crypto→fiat)
- [ ] Live rates: fetches on pair change + every 15s; RefreshCw spin active while fetching; "1 CUR ≈ rate CUR" line
- [ ] **developer_fee visible**: dedicated row "Developer fee (1.0%)" with Info tooltip, monetary deduction above the fold
- [ ] "You receive" = `(amount − fee) × rate`, computed live, tabular nums in display font
- [ ] Destination logic: crypto→fiat requires a matching-currency bank (select + "add one first" hint linking to Banks); fiat→crypto requires a valid USDC-on-Base wallet (`0x` + 40 hex, inline error)
- [ ] KYC gate: disabled confirm + amber banner (KycBanner) when not `approved`
- [ ] On confirm: button **immediately disabled with in-button Loader2 spinner** ("Awaiting webhook confirmation…") and persistent toast: **"Transaction processing. Awaiting Bridge API webhook confirmation…"** — persists until state update, auto-resolves to success/info/error toast on terminal state
- [ ] Toast resilience: navigating away and back cannot orphan or duplicate the toast (registry-backed, E2E-verified)
- [ ] Live transfer card: 4-step timeline Clock → Wallet → Send → CheckCircle2 with pulsing current step; exception states shown as badge; **Cancel transfer offered ONLY while `awaiting_funds`** (hidden after; confirm dialog; 409 toast otherwise)
- [ ] Fiat-funded transfers surface the virtual account deposit instructions (bank, routing, account)
- [ ] Recent transfers list: amount → dest currency, timestamp, fee, copy-to-clipboard tx hash (mono font, truncated), state badges for **all 11 states**
- [ ] Overview KPIs populated from real state: Volume converted (total + 30d), Completed transfers (+in-flight), Fees paid, Linked accounts (+rails); 14-day volume bars; status breakdown; recent-activity feed
- [ ] i18n across the convert/overview surface ⚠️ *not implemented*

### 2. Backend / API / Vault
- [ ] `client.transfers.create` proxies to Bridge `POST /transfers` with client-generated UUID `Idempotency-Key` (24h) ⚠️ *design-only live; mock enforces identical semantics — verified: same key+body replays original; same key+different body → 409; double-click reuses the in-flight key*
- [ ] `developer_fee` computed server-side and stored as decimal string on the transfer (1.0% of amount) — verified `$250 → $2.50`
- [ ] KYC precondition: create rejected unless customer `approved` (403)
- [ ] Amount validation: positive, finite, 422 otherwise
- [ ] `DELETE /v1/transfers/{id}` only from `awaiting_funds` (mirrors Bridge; 409 otherwise) — verified in both directions
- [ ] Rates endpoint returns mid/buy/sell with sane ordering (buy < mid < sell) and 404 for unsupported pairs

### 3. Webhooks & asynchronous logic
- [ ] `transfer` category events drive state transitions; happy path strictly `awaiting_funds → funds_received → payment_submitted → payment_processed` (never backwards) ⚠️ *simulated 3s/2s/2s; live webhooks pending*
- [ ] Timers/cancellation race safe: a canceled transfer must stop progressing even if a transition timer fires afterwards — verified
- [ ] `payment_processed` settles a final `receipt.transaction_hash` (0x + 64 hex)
- [ ] Canceled transfers after `funds_received` rejected (409)
- [ ] Every state write triggers UI refetch via the realtime hub; cross-tab propagation **without reload** — E2E-verified (storage event ≈ future Supabase Realtime)
- [ ] `virtual_account.activity` credits advance `awaiting_funds` transfers ⚠️ *design-only*

---

## Sprint 4 — Vault hardening (database, webhooks, security)

### Module: Supabase schema (`supabase/migrations/0001_init.sql`)
- [ ] Tables: `profiles`, `bridge_customers`, `external_accounts`, `virtual_accounts`, `transfers`, `idempotency_keys`, `webhook_events` — applied to a real Supabase project ⚠️ *SQL exists; not executed*
- [ ] Enums: all statuses incl. 11-value `transfer_state`; rail-specific account fields in `details`/`deposit_instructions` jsonb
- [ ] RLS: users read **own** rows only (joins via `bridge_customers.user_id`); **no write policies** — all writes service-role only
- [ ] `idempotency_keys`: PK on key, 24h `expires_at` default, expiry index, request-hash column for conflict detection — no client policies
- [ ] `webhook_events`: `event_id` PK dedupe, `event_sequence` ordering, category index, `processed_at` — no client policies
- [ ] Realtime publication adds the four UI-facing tables (`bridge_customers`, `external_accounts`, `virtual_accounts`, `transfers`)

### Module: Webhook receiver (`POST /webhooks/bridge`)
- [x] Verify-before-parse: raw body read; header `X-Webhook-Signature: t=<ms>,v0=<base64>` parsed with strict format errors (`missing_header`, `bad_format`) — implemented in `lib/vault/webhook-verification.ts` + `app/api/webhooks/bridge/route.ts`
- [x] Signature over **SHA256(SHA256("<t>.<rawBody>"))** — double-hash digest passed to `crypto.verify` (Ed25519 null-algorithm, RSA sha256 fallback); tampered body rejected — **proven in the logic suite with a generated Ed25519 keypair**
- [x] Replay window: deliveries older than 10 minutes → `stale_timestamp` (400) — tested
- [ ] Dedupe on `event_id` (insert-or-skip → 200 immediately): schema + rules ready; live persistence pending the Vault (simulated pipeline marks `delivery: 'simulated'` on the audit trail, replay dedupe works in the backoffice log)
- [ ] Handlers live against real Bridge deliveries: `customer`, `kyc_link`, `transfer`, `virtual_account.activity`, `external_account` — mock parity: the simulated pipeline logs every transition to the same audit trail and the KYC/transfer handlers are exercised by ops replay
- [ ] End-to-end with Bridge `POST /webhooks/{id}/send` before enabling — requires the live webhook provisioning (G1)

### Module: Secrets & keys
- [ ] `BRIDGE_API_KEY` exists only in the Vault env; never in the Next.js bundle, never in `NEXT_PUBLIC_*` (verified by bundle grep)
- [ ] `BRIDGE_WEBHOOK_PUBLIC_KEY` per-endpoint, injected via env, rotate-able
- [ ] `.env.example` documents every variable for both apps ⚠️ *pending until Vault scaffolding begins*

---

## Sprint 5 — Notifications, Backoffice & i18n

### Module: Transactional email (Resend)
- [x] **Mocked pipeline live**: terminal transfer states (`payment_processed`, `canceled`, `refunded`) queue customer notifications into the outbox; visible and sendable in `/admin/emails` — verified
- [ ] Resend HTTP call with verified domain + sender — pending `RESEND_API_KEY` (queue → sent button stands in)
- [ ] Emails on terminal transfer states wired to the live send path (today: audit shows `queued`)
- [ ] Templates hold for EN/ES/PT-BR with unsubscribe footer

### Module: Backoffice / admin console — **built (mocked) at `/admin`**
- [x] Separate ops auth (`admin@hash.demo` / `hash-admin-2026`), isolated from client sessions, cross-tab via realtime mockery
- [x] KYC review queue: every customer with status/endorsements/account/transfer counts + ops **Approve / Reject** that feeds the same `customer` webhook simulation
- [x] Transfers monitor: global list, filter chips for all 11 states, ops **cancel** (only `awaiting_funds`, same rule), receipt hash copy
- [x] Webhook delivery log: full audit trail by event, `simulated`/`live` delivery badges, **replay tool** with idempotent outcomes (applied / duplicate / obsolete)
- [x] Idempotency audit: 24h key ledger with expiry states; conflicts surfaced as `idempotency.conflict` events
- [x] Operations overview: platform volume, fees accrued, failure rate, customers by status, transfers by state
- [x] Transactional email outbox with template + status + send action
- [ ] Role-based access beyond the single demo admin (RBAC matrix)

### Module: Internationalization (EN / ES / PT-BR)
- [ ] i18n routing/dictionary infrastructure (e.g. `next-intl`)
- [ ] 100% string extraction for auth, onboarding, banks, convert, overview
- [ ] Locale-aware currency and number formatting (BRL/MXN/EUR correct grouping)
- [ ] Language switcher persisted per user ⚠️ *nothing started*

---

## Sprint 6 — Hardening, QA & release

- [ ] Accessibility pass: visible focus rings, labeled inputs, `aria-label`s on icon-only buttons, reduced-motion respected (flip button, pulsing steps)
- [ ] Error boundaries per route segment; no white screens on runtime failures
- [ ] Responsive QA: mobile top-bar nav usable at 360px; swap widget and dialogs usable one-handed
- [ ] Performance: routes render instantly in production build (`instant = false` only where justified, documented in each server shell)
- [ ] Security review in the built bundle: no mock secrets, no Bridge references, no plaintext credentials beyond the demo mock's explicit note
- [ ] Full harness green on a fresh clone: typecheck ✓ lint ✓ build ✓ `verify:mock` ✓ `verify:e2e` ✓
- [ ] README reflects final IA (**incl. the new /dashboard overview**) + demo reset instructions
- [ ] Release: tag `v0.1.0-mvp`, remote pushed, deploy target chosen (Vercel/Fly) with preview env

---

## Gap registry (top-level, owned items)

| # | Gap | Impact | Sprint |
|---|---|---|---|
| G1 | Vault not live (Bridge real calls, Supabase, Realtime) — needs a Bridge sandbox key + a Supabase project | Demo-only until built | S4 |
| G2 | Live Bridge→Vault webhooks: receiver implemented **and crypto-tested**; missing only real endpoint provisioning + Bridge delivery wiring | Needs Bridge credentials | S4 |
| G3 | ~~Backoffice/admin console absent~~ **RESOLVED** — mocked ops console at `/admin` (KYC queue, transfers monitor, webhook log + replay, idempotency audit, email outbox, ops KPIs) | — | ✅ |
| G4 | i18n EN/ES/PT-BR absent | ES/BR customers see EN | S5 |
| G5 | Resend emails: mocked queue→send pipeline live in `/admin/emails`; HTTP call pending `RESEND_API_KEY` | Notifications don't leave the demo | S5 |
| G6 | COP / Faster Payments rails deferred beyond endorsement UI | "6 rails" expectation gap | later |
| G7 | ~~Git remote missing~~ **RESOLVED** — pushed to `github.com/MateusPaiv/hash-demo` (main); deploy at Vercel via Root Directory `apps/vitrine` | — | ✅ |
