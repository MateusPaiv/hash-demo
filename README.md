# Hash — fiat ⇄ crypto payments platform

Vitrine (frontend showcase) for a Bridge API–powered payments platform, built
with Next.js 16, TypeScript, Tailwind v4 and shadcn/ui. **The current build is
fully mocked** — no Supabase project, no Bridge keys, no real money. The mock
layer reproduces latency, realtime updates, webhook-driven state transitions
and idempotency so every screen behaves like production.

## Quickstart

```bash
npm install          # npm workspaces: apps/* + packages/*
npm run dev          # → http://localhost:3000
```

## Demo script

1. **Sign up** (`/signup`) — email + password (mock auth).
2. **Onboarding** (`/onboarding`) — click *Start verification*; a simulated
   Bridge hosted KYC page opens in a new tab. Complete it and watch the status
   flip `under_review → approved` live, with endorsements (base/SEPA/SPEI/Pix).
3. **Banks** (`/dashboard/banks`) — add accounts per rail; the form adapts:
   USD→ACH/Wire (routing+account), EUR→IBAN/BIC, MXN→18-digit CLABE,
   BRL→Pix key (CPF/CNPJ/email/phone/EVP), each with per-rail validation.
4. **Convert** (`/dashboard/convert`) — swap fiat→USDC or USDC→fiat with live
   (mock) rates and a visible 1% developer fee. *Confirm transfer* disables the
   button, shows a spinner and a persistent toast until the simulated Bridge
   webhooks advance the transfer through `awaiting_funds → funds_received →
   payment_submitted → payment_processed` (~7s). Cancel is available **only**
   while `awaiting_funds` — same rule as Bridge's `DELETE /v0/transfers/{id}`.
5. **Backoffice** (`/admin`) — mocked ops console with its own login:
   `admin@hash.demo` / `hash-admin-2026`. Platform KPIs, KYC review queue with
   Approve/Reject, transfers monitor (all 11 states + ops cancel), webhook
   delivery log with idempotent replay, idempotency-key audit, and the
   transactional-email outbox. Reachable from the client sidebar too. A
   signature-verified webhook receiver (double-SHA256, Ed25519) lives at
   `POST /api/webhooks/bridge` — activate with `BRIDGE_WEBHOOK_PUBLIC_KEY`.

State persists in `localStorage` (`hash_mock_db_v1`); clear it to reset the demo.

## Repository layout

```
apps/vitrine/        Next.js 16 app — the Vitrine (all UI + mock engine)
  src/lib/api/       THE facade every screen talks to (mirrors the Cofre REST contract)
  src/lib/mock/      store (localStorage), realtime pub/sub, state machines, fixtures
packages/shared/     @hash/shared — strict Bridge API v0 TypeScript types
                     (Customer+endorsements, rail-typed ExternalAccount, VirtualAccount,
                      Transfer with all 11 states + developer_fee, webhook envelope, rates)
supabase/migrations/ 0001_init.sql — production schema blueprint (RLS, realtime,
                     idempotency_keys, webhook_events) — not executed by the demo
docs/cofre-contract.md — Backend Vault spec: REST surface, idempotency rules,
                     webhook signature verification (double-SHA256), event handling
docs/dod-checklist.md — Definition of Done + QA completion checklist (by sprint/module)
```

## Architecture in one paragraph

The UI never imports the mock engine directly — only the `client.ts` facade,
whose method surface mirrors the future Cofre REST API. Going live means
re-implementing that facade with HTTP calls; components, hooks and types stay
untouched. The Bridge `Api-Key` will live exclusively in the Cofre; all Bridge
POSTs are wrapped in 24h `Idempotency-Key`s persisted server-side; webhooks are
signature-verified (double-SHA256 digest), deduped by `event_id`, and reach the
UI through Postgres + Supabase Realtime. Full details: `docs/cofre-contract.md`.

## Deploy to Vercel

The repo is a single Next.js app inside an npm-workspaces monorepo, so point
Vercel at the app:

1. Import `MateusPaiv/hash-demo` into Vercel.
2. **Root Directory:** `apps/vitrine` (framework auto-detects Next.js).
3. No environment variables required — the demo is fully mocked; zero secrets
   shipped (the Bridge `Api-Key` belongs to the Cofre, never to this repo).

`npm install` is run at the workspace root automatically so `@hash/shared`
resolves. Every page is static — the build is cheap.

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start the Vitrine dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
