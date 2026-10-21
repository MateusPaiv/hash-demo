# Conformidade — Escopo Funcional Bridge (doc do cliente, 20/10/2026)

Auditoria do código atual contra o escopo. Legenda: ✅ implementado · 🟡 mockado/paridade (funciona no demo, vivo com o Vault) · ⚠️ parcial · ❌ ausente. MVP e Fase 2 seguem a prioridade do doc do cliente.

## 1. Clientes e KYC/KYB

| Função | Prioridade | Status | Nota / evidência |
|---|---|---|---|
| POST /kyc_links (hospedado, com ToS) | MVP | 🟡 mockado | `client.kyc.createLink` → simulador hospedado + fluxo `under_review→approved` em tempo real |
| GET /kyc_links/{id} (status) | MVP | 🟡 mockado | status chega por eventos `customer`/`kyc_link` simulados; consulta direta pendente no Vault |
| POST /customers/tos_links | MVP* | ⚠️ | *"se onboarding via API"* — fluxo hospedado cobre ToS embutido; endpoint dedicado pendente |
| GET /customers/{id}/kyc_link (reverificação) | MVP | 🟡 mockado | card `rejected` → "Try again" re-executa `createLink` |
| GET /customers/{id} (status/endorsements) | MVP | 🟡 mockado | `customer.me()` + tela de status em tempo real |
| GET /customers (listar — backoffice) | MVP (backoffice) | ✅ | `/admin/kyc` lista todos + decisões (paridade de `simulate_kyc_approval`) |
| Criar cliente via API | Opcional | ❌ | fora do MVP |
| Listas auxiliares (países, ocupação) | MVP (formulários) | ⚠️ | não usado ainda: KYC é hospedado; entra se a ficha interna ler esses dados |
| Endorsements ativos + o que falta | MVP | ✅ | `/dashboard/receive` mostra por moeda o endorsement exigido e o que falta; onboarding lista os ativos |
| RFI expirando aplicação | risco | ⚠️ | copy de under_review existe; mensagem de RFI específica pendente |

## 2. Contas externas

| Função | Prioridade | Status |
|---|---|---|
| Cadastrar conta (ACH/wire, IBAN, CLABE, Pix, Colômbia, UK) | MVP | ✅ 5 moedas × 7 rails no formulário dinámico (usd ach/wire, eur iban, gbp faster_payments, mxn clabe, brl pix, cop bank_transfer_co) com validação por rail |
| Listar contas do cliente | MVP | ✅ |
| Consultar conta | MVP | 🟡 via listagem (rota GET por id pendente no Vault) |
| **Desativar / reativar** | **MVP** | ✅ Power toggle no card (exclusão removida do cliente — Fase 2 por escopo) |
| Excluir | Fase 2 | — (corretamente fora) |
| Atualizar | Fase 2 | — |
| Plaid | Opcional | ❌ fora |
| fiat_payout_configuration | Fase 2 | — |

## 3. Transferências

| Função | Prioridade | Status |
|---|---|---|
| POST /transfers (on-ramp, off-ramp, cripto-cripto) | MVP | 🟡 mockado — on-ramp (fiat→USDC) e off-ramp (USDC→fiat); cripto-cripto fora do Convert MVP |
| GET transfer / listar (geral e por cliente) | MVP | 🟡 listagem por cliente (Convert/Overview) + global (backoffice) |
| **Cancelar em awaiting_funds** | MVP | ✅ regra idêntica nos dois lados + 409 |
| Cotação GET /exchange_rates | MVP | 🟡 mid/buy/sell, refresh ao vivo (6 moedas ✓) |
| developer_fee | MVP | ✅ configurável no backoffice (PUT /developer/fees) e aplicado em cada transfer |
| flexible_amount, return_instructions | (produto) | ❌ não expostos — registrar no design do Vault |
| **Estados com rótulo em PT-BR** | MVP | ✅ badges e timeline: Aguardando recursos, Em revisão, Recursos recebidos, Pagamento enviado, Concluído, Cancelado, Não entregável, Retornado, Reembolso em trânsito, Falha no reembolso, Reembolsado (11/11) |

## 4. Contas virtuais

| Função | Prioridade | Status |
|---|---|---|
| Criar/consultar/listar VAs | MVP | 🟡 moeda a Moeda em `/dashboard/receive`, doute por endorsement (ex.: Pix VA exige endorsement pix) |
| **Extrato de depósitos (histórico)** | MVP | ✅ ledger por moeda: depósito `pending` na criação → `received` no webhook funds_received |
| Atualizar destino/fee da VA | Fase 2 | — |
| Atividade geral (backoffice) | Fase 2 | — |

## 5. Liquidation / static memos / prefunded

Fase 2 / Opcional — corretamente fora. Nenhum endpoint deprecated (`…/balances`) no código. ✅ conforme riscos.

## 6. Wallets e cartões

Opcional/Fase 2 — fora do MVP. ✅ "Coming soon" equivalente está ausente por decisão, sem endpoints esquecidos.

## 7. Infraestrutura (autenticação, taxas, webhooks, sandbox)

| Função | Prioridade | Status |
|---|---|---|
| Idempotency-Key em todo POST (24h) | infra | ✅ implementado (store + conflito 409 logado) |
| Api-Key header (Vault-only) | infra | ✅ ausente do bundle por design; gerência no Vault pendente |
| Webhook: validar assinatura | MVP | ✅ lib double-SHA256/Ed25519 + receiver `POST /api/webhooks/bridge`, testado (válido, tamper, stale, missing) |
| Webhook idempotente | MVP | ✅ dedupe por event_id + replay idempotente no log |
| Categorias assinadas no MVP | MVP | ✅ customer, kyc_link, transfer, virtual_account.activity + external_account (5/5 cobertas no mock de auditoria) |
| POST /webhooks + gestão de eventos/logs | MVP | 🟡 auditoria própria existe; provisionamento vivo no Bridge pendente (chave sandbox) |
| GET /api_keys/whoami (health) | MVP | ❌ trivial — entrar no primeiro deploy do Vault |
| GET/PUT /developer/fees | **MVP** | ✅ `/admin/fees` — fee percentual editável e aplicado |
| GET/POST /developer/fee_external_account | MVP | ⚠️ tela mostra fixture; config real no Vault |
| simulate_kyc_approval (sandbox) | MVP | ✅ paridade: decisões do backoffice + simulador |
| Paginação por cursor | req. técnico | ❌ facade mock não pagina — exigência do Vault antes de live |
| E-mails ao cliente | MVP | ✅ pipeline fila→outbox→UI; Resend vivo requer `RESEND_API_KEY` |

## 8. Telas do mapa do produto

| Tela | Fase | Status |
|---|---|---|
| Onboarding / Settings › Verificação | MVP | ✅ (+ selector em tempo real cross-tab) |
| Settings › Contas bancárias | MVP | ✅ (criar/listar/desativar) |
| Transfer › Convert | MVP | ✅ (on-ramp/off-ramp; cripto-cripto pós-MVP) |
| **Receber fiat** | **MVP** | ✅ `/dashboard/receive` — VAs por moeda + extrato + map de endossos |
| Histórico / extrato | MVP | ✅ Overview + Convert + extrato de VAs |
| Notificações / e-mails | MVP | 🟡 pipeline mock; Resend pendente de chave |
| **Backoffice / admin** | **MVP** | ✅ clientes, transfers, webhook logs, **taxas**; listagem global de VAs (Fase 2) fora — correto |
| Saque automático (liquidation) | Fase 2 | — |
| Cards | Fase 2 | — |
| Team (Admin/Bookkeeper) | MVP | ⚠️ console ops com sessão própria; RBAC Admin/Bookkeeper ainda pendente |

## Pendências do doc × decisão

| Pendência do doc | Estado aqui |
|---|---|
| Endorsements liberados no contrato | modelagem cobre os 6; ativação real depende do contrato |
| modelo de taxa (fixo ou percentual) | percentual implementado (configurável 0–5) |
| Bridge Wallets vs Utila | fora do MVP ✓ Utila única custódia |
| pares moeda×chain no sandbox | USDC/Base único exposto; validação real no sandbox |
| módulo Cards pós-Stripe | fora ✓ |

## Resumo — furos restantes para o MVP do doc

1. **G1** Vault vivo (chamadas reais + Supabase + Realtime) — depende de credenciais sandbox/contrato.
2. **G2-fim** provisionar webhook no Bridge e receber entregas reais.
3. **G4** i18n completo (rótulos de estado já PT; chrome/telas ainda EN) — doc também lista ES como idioma futuro.
4. **RBAC** Team (Admin/Bookkeeper) — permissões internas.
5. Páginação por cursor + `whoami` + ToS link dedicado — na fase Vault.
