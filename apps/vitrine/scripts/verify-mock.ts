/**
 * Headless verification of the mock engine — runs in Node via tsx.
 * Covers the paths a quick browser walkthrough can miss: per-rail validation,
 * idempotency (replay + conflict), the cancel-only-while-awaiting_funds rule,
 * webhook-simulated transfer progression, and the KYC lifecycle.
 *
 * Usage: npm run verify:mock   (takes ~35s — real simulated-webhook timers)
 */
import { client, ApiError } from '../src/lib/api/client';
import { adminApi } from '../src/lib/api/admin';
import type { CreateTransferInput } from '../src/lib/api/types';
import { bankAccountSchema } from '../src/components/banks/rail-config';
import { computeDashboardMetrics, volumeByDay } from '../src/lib/metrics';
import { verifyBridgeWebhookSignature, bridgeSignatureDigest } from '../src/lib/vault/webhook-verification';
import { generateKeyPairSync, sign } from 'node:crypto';
import { loadDB } from '../src/lib/mock/store';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectError(name: string, status: number, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(name, false, 'expected an error, got success');
  } catch (error) {
    const ok = error instanceof ApiError && error.status === status;
    check(name, ok, ok ? '' : `got: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const WALLET = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

async function main(): Promise<void> {
  console.log('\n— auth + KYC lifecycle');
  const email = `verify_${Date.now()}@hash.demo`;
  await client.auth.signUp({ full_name: 'Verify Bot', email, password: 'password123' });
  let customer = await client.customer.me();
  check('signup → customer not_started', customer.status === 'not_started');
  await expectError('signIn wrong password → 401', 401, () =>
    client.auth.signIn({ email, password: 'wrong-one' }),
  );

  const { url } = await client.kyc.createLink();
  check('createLink → hosted KYC url', url === '/kyc-simulator', url);
  await client.kyc.completeHostedSession('approved');
  customer = await client.customer.me();
  check('hosted completion → under_review', customer.status === 'under_review');
  console.log('  … waiting for the simulated KYC webhook (5s)');
  await sleep(5_600);
  customer = await client.customer.me();
  check('webhook → approved', customer.status === 'approved', customer.status);
  const endorsements = customer.endorsements.map((e) => e.name).sort().join(',');
  check('endorsements = base,pix,sepa,spei', endorsements === 'base,pix,sepa,spei', endorsements);

  console.log('\n— exchange rates');
  const quote = await client.rates.get('usd', 'usdc');
  const buy = Number(quote.buy_rate);
  const mid = Number(quote.mid_rate);
  const sell = Number(quote.sell_rate);
  check('rate shape: buy < mid < sell', buy < mid && mid < sell, `${buy} / ${mid} / ${sell}`);
  await expectError('unsupported pair → 404', 404, () => client.rates.get('usd', 'usd'));

  console.log('\n— external accounts: per-rail validation');
  check(
    'ach: 8-digit routing rejected',
    !bankAccountSchema.safeParse({
      rail: 'ach',
      account_holder_name: 'Verify Bot',
      bank_name: 'Lead Bank',
      routing_number: '12345678',
      account_number: '123456789',
      account_subtype: 'checking',
    }).success,
  );
  check(
    'clabe: 17 digits rejected',
    !bankAccountSchema.safeParse({
      rail: 'clabe',
      account_holder_name: 'Verify Bot',
      bank_name: 'BBVA',
      clabe: '12345678901234567',
    }).success,
  );
  check(
    'pix: short CPF rejected',
    !bankAccountSchema.safeParse({
      rail: 'pix',
      account_holder_name: 'Verify Bot',
      pix_key_type: 'cpf',
      pix_key: '12345',
    }).success,
  );
  check(
    'iban: malformed rejected',
    !bankAccountSchema.safeParse({
      rail: 'iban',
      account_holder_name: 'Verify Bot',
      bank_name: 'Commerzbank',
      iban: 'XX12',
      bic: 'COBADEFFXXX',
    }).success,
  );
  const ibanWithSpaces = bankAccountSchema.safeParse({
    rail: 'iban',
    account_holder_name: 'Verify Bot',
    bank_name: 'Commerzbank',
    iban: 'DE89 3704 0044 0532 0130 00',
    bic: 'COBADEFFXXX',
  });
  check('iban: space-separated groups accepted', ibanWithSpaces.success);
  check(
    'pix: valid 11-digit CPF accepted',
    bankAccountSchema.safeParse({
      rail: 'pix',
      account_holder_name: 'Verify Bot',
      pix_key_type: 'cpf',
      pix_key: '12345678901',
    }).success,
  );

  console.log('\n— external accounts: create / list / remove');
  const ach = await client.externalAccounts.create({
    rail: 'ach',
    bank_name: 'Lead Bank',
    account_holder_name: 'Verify Bot',
    routing_number: '021000021',
    account_number: '123456789',
    account_subtype: 'checking',
  });
  check('create ach → usd', ach.rail === 'ach' && ach.currency === 'usd');
  const pix = await client.externalAccounts.create({
    rail: 'pix',
    account_holder_name: 'Verify Bot',
    pix_key: '12345678901',
    pix_key_type: 'cpf',
  });
  check('create pix without bank_name → default filled', pix.bank_name.length > 0, pix.bank_name);
  const ibanAccount = await client.externalAccounts.create({
    rail: 'iban',
    bank_name: 'Commerzbank',
    account_holder_name: 'Verify Bot',
    iban: 'DE89 3704 0044 0532 0130 00',
    bic: 'COBADEFFXXX',
  });
  check(
    'iban stored normalized (spaces stripped, uppercased)',
    ibanAccount.rail === 'iban' && ibanAccount.iban === 'DE89370400440532013000',
    ibanAccount.rail === 'iban' ? ibanAccount.iban : '',
  );
  const listed = await client.externalAccounts.list();
  check('list returns 3 accounts', listed.length === 3, String(listed.length));
  await client.externalAccounts.deactivate(ach.id);
  const deactivatedList = await client.externalAccounts.list();
  check(
    'deactivate sets status (scope: reactivate toggles back)',
    deactivatedList.find((a) => a.id === ach.id)?.status === 'deactivated',
  );
  await client.externalAccounts.reactivate(ach.id);
  check(
    'reactivate brings the account back',
    (await client.externalAccounts.list()).find((a) => a.id === ach.id)?.status === 'active',
  );

  console.log('\n— GBP / COP rails (6-currency fiat coverage)');
  check(
    'GBP: bad sort code rejected',
    !bankAccountSchema.safeParse({
      rail: 'faster_payments',
      account_holder_name: 'Verify Bot',
      bank_name: 'Monzo',
      sort_code: '12345',
      account_number: '12345678',
    }).success,
  );
  const gbp = await client.externalAccounts.create({
    rail: 'faster_payments',
    bank_name: 'Monzo',
    account_holder_name: 'Verify Bot',
    sort_code: '101010',
    account_number: '12345678',
  });
  check('create GBP faster_payments → gbp', gbp.rail === 'faster_payments' && gbp.currency === 'gbp');
  const cop = await client.externalAccounts.create({
    rail: 'bank_transfer_co',
    bank_name: 'Bancolombia',
    account_holder_name: 'Verify Bot',
    account_number: '123456789',
    account_subtype: 'checking',
  });
  check('create COP bank transfer → cop', cop.rail === 'bank_transfer_co' && cop.currency === 'cop');
  const gbpRate = await client.rates.get('gbp', 'usdc');
  check('GBP rate available', Number(gbpRate.mid_rate) > 1, gbpRate.mid_rate);
  const copRate = await client.rates.get('usdc', 'cop');
  check('COP rate available', Number(copRate.mid_rate) > 1000, copRate.mid_rate);

  console.log('\n— virtual accounts + deposit ledger');
  const virtualAccounts = await client.virtualAccounts.mine();
  check(
    'USD virtual account provisioned after approval',
    virtualAccounts.length === 1 &&
      virtualAccounts[0].currency === 'usd' &&
      !!virtualAccounts[0].deposit_instructions.routing_number,
  );
  check(
    'GBP VA requires the faster_payments endorsement (absent → none)',
    (await client.virtualAccounts.mine('gbp')).length === 0,
  );

  console.log('\n— transfers: idempotency');
  const key = crypto.randomUUID();
  const body: CreateTransferInput = {
    amount: '250.00',
    source_currency: 'usd',
    destination_currency: 'usdc',
    destination_wallet_address: WALLET,
    developer_fee_percent: '1.0',
    idempotency_key: key,
  };
  const first = await client.transfers.create(body);
  check('create → awaiting_funds', first.transfer.state === 'awaiting_funds' && !first.deduplicated);
  check('developer_fee = 1% of 250 → 2.50', first.transfer.developer_fee === '2.50', first.transfer.developer_fee);
  const replay = await client.transfers.create({ ...body });
  check(
    'same key + same body → original transfer, deduplicated',
    replay.deduplicated && replay.transfer.id === first.transfer.id,
  );
  await expectError('same key + different body → 409', 409, () =>
    client.transfers.create({ ...body, amount: '999.00' }),
  );

  console.log('\n— transfers: cancel only while awaiting_funds');
  const canceled = await client.transfers.cancel(first.transfer.id);
  check('cancel during awaiting_funds → canceled', canceled.state === 'canceled');
  await expectError('cancel an already-canceled transfer → 409', 409, () =>
    client.transfers.cancel(first.transfer.id),
  );

  const late = await client.transfers.create({ ...body, idempotency_key: crypto.randomUUID() });
  console.log('  … waiting 3.5s for the funds_received webhook');
  await sleep(3_400);
  await expectError('cancel after funds_received → 409', 409, () =>
    client.transfers.cancel(late.transfer.id),
  );

  console.log('\n— transfers: happy path via simulated webhooks');
  console.log('  … waiting ~5.5s for payment_processed');
  await sleep(5_500);
  const all = await client.transfers.list();
  const progressed = all.find((t) => t.id === late.transfer.id);
  check('reached payment_processed', progressed?.state === 'payment_processed', progressed?.state);
  check(
    'receipt carries a 0x + 64-hex tx hash',
    !!progressed?.receipt?.transaction_hash && /^0x[0-9a-f]{64}$/.test(progressed.receipt.transaction_hash),
    progressed?.receipt?.transaction_hash,
  );
  check(
    'canceled transfer stayed canceled (timers respected the cancel)',
    all.find((t) => t.id === first.transfer.id)?.state === 'canceled',
  );

  console.log('\n— dashboard metrics');
  const metrics = computeDashboardMetrics(all);
  check(
    'metrics: 1 completed · 1 canceled · 0 in flight',
    metrics.completed.length === 1 && metrics.canceled.length === 1 && metrics.inFlight.length === 0,
    `completed=${metrics.completed.length} canceled=${metrics.canceled.length} inFlight=${metrics.inFlight.length}`,
  );
  check(
    'metrics: total volume ≈ $250.00 (USD-equivalent)',
    Math.abs(metrics.totalVolumeUsd - 250) < 0.5,
    String(metrics.totalVolumeUsd),
  );
  check(
    'metrics: fees paid ≈ $2.50',
    Math.abs(metrics.feesUsd - 2.5) < 0.1,
    String(metrics.feesUsd),
  );
  check('metrics: 14-day volume series has 14 buckets', volumeByDay(all).length === 14);

  console.log('\n— VA deposit ledger + configurable platform fee');
  const depositsUsd = await client.virtualAccounts.activity('usd');
  check(
    'fiat-funded transfers registered VA deposits',
    depositsUsd.length >= 2,
    String(depositsUsd.length),
  );
  check(
    'deposits settle at funds_received; canceled/pending stay truthful',
    depositsUsd.find((d) => d.transfer_id === late.transfer.id)?.status === 'received' &&
      depositsUsd.find((d) => d.transfer_id === first.transfer.id)?.status === 'pending',
    depositsUsd.map((d) => `${d.transfer_id}:${d.status}`).join(','),
  );
  await adminApi.fees.set('2.0');
  const feeProbe = await client.transfers.create({ ...body, idempotency_key: crypto.randomUUID() });
  check(
    'PUT /developer/fees feeds transfer creation (2% of 250 → 5.00)',
    feeProbe.transfer.developer_fee === '5.00',
    feeProbe.transfer.developer_fee,
  );
  await adminApi.fees.set('1.0');

  console.log('\n— webhook event log + transactional email pipeline');
  const events = loadDB().webhook_events;
  check('webhook audit trail populated by state transitions', events.length >= 5, String(events.length));
  const categories = new Set(events.map((e) => e.event_category));
  check('audit covers customer + transfer categories', categories.has('customer') && categories.has('transfer'));
  check('idempotency.conflict logged for the reused key', events.some((e) => e.event_type === 'idempotency.conflict'));
  const outbox = loadDB().email_outbox;
  check(
    'email queued for the completed transfer',
    outbox.some((e) => e.template === 'transfer.completed' && e.status === 'queued'),
    outbox.map((e) => e.template).join(','),
  );
  check(
    'every queued email targets the customer address',
    outbox.length > 0 && outbox.every((e) => e.to === email),
    outbox.length > 0 ? `to=${outbox[0].to}` : 'outbox empty',
  );

  console.log('\n— vault webhook signature verification (Ed25519, double-SHA256)');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const eventBody = JSON.stringify({
    event_id: 'wh_test_1',
    event_category: 'transfer',
    event_object_status: 'payment_processed',
  });
  const signHeader = (timestamp: number, body: string) => {
    const digest = bridgeSignatureDigest(timestamp, body);
    return `t=${timestamp},v0=${sign(null, digest, privateKey).toString('base64')}`;
  };
  const now = Date.now();
  check(
    'valid signature verifies',
    verifyBridgeWebhookSignature({ rawBody: eventBody, header: signHeader(now, eventBody), publicKeyPem, nowMs: now }).valid,
  );
  const tampered = verifyBridgeWebhookSignature({
    rawBody: eventBody.replace('payment_processed', 'awaiting_funds'),
    header: signHeader(now, eventBody),
    publicKeyPem,
    nowMs: now,
  });
  check('tampered body → invalid_signature', !tampered.valid && tampered.failure === 'invalid_signature', tampered.valid ? '' : tampered.failure);
  const stale = verifyBridgeWebhookSignature({
    rawBody: eventBody,
    header: signHeader(now - 11 * 60_000, eventBody),
    publicKeyPem,
    nowMs: now,
  });
  check('stale delivery (>10min) → stale_timestamp', !stale.valid && stale.failure === 'stale_timestamp', stale.valid ? '' : stale.failure);
  const missing = verifyBridgeWebhookSignature({ rawBody: eventBody, header: null, publicKeyPem, nowMs: now });
  check('missing header → missing_header', !missing.valid && missing.failure === 'missing_header');

  const db = loadDB();
  check('idempotency keys persisted (24h TTL records)', db.idempotency_keys.length >= 2, String(db.idempotency_keys.length));

  console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
