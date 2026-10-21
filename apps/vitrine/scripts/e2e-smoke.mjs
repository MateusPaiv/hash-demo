#!/usr/bin/env node
/**
 * Browser smoke test — closes the gaps a headless logic test can't reach:
 *   1. cross-tab live updates WITHOUT reload (KYC simulator tab → onboarding tab)
 *   2. banks walkthrough: dynamic per-rail fields + inline validation errors
 *   3. convert: persistent processing toast, disabled spinner button,
 *      cancel only while awaiting_funds, and the happy path to Completed
 *
 * Usage: npm run verify:e2e   (spawns its own dev server on :3111, ~90s)
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3111;
const BASE = `http://localhost:${PORT}`;
let failures = 0;

const log = (...args) => console.log(...args);

async function check(name, fn) {
  try {
    await fn();
    log(`  PASS  ${name}`);
  } catch (error) {
    failures++;
    log(`  FAIL  ${name} — ${String(error.message).split('\n')[0]}`);
  }
}

async function waitForServer(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/login`);
      if (response.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('dev server did not become ready');
}

const waitText = (page, text, timeout = 20_000) =>
  page.getByText(text).first().waitFor({ state: 'visible', timeout });

async function main() {
  log('\n— booting dev server');
  const server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (process.env.E2E_VERBOSE) {
    server.stdout.pipe(process.stdout);
    server.stderr.pipe(process.stderr);
  }

  let browser;
  try {
    await waitForServer();
    log(`  ready on ${BASE}`);

    browser = await chromium.launch();
    const context = await browser.newContext();
    const pageA = await context.newPage();
    pageA.setDefaultTimeout(60_000);
    const email = `e2e_${Date.now()}@hash.demo`;

    log('\n— signup → onboarding');
    await pageA.goto(`${BASE}/signup`);
    await pageA.fill('#full_name', 'E2E Bot');
    await pageA.fill('#email', email);
    await pageA.fill('#password', 'password123');
    await pageA.getByRole('button', { name: /Create account/ }).click();
    await check('lands on /onboarding', () => pageA.waitForURL('**/onboarding', { timeout: 30_000 }));
    await check('shows the not-started KYC card', () => waitText(pageA, /Verify your identity/));
    await check('type system applied (Inter body, Space Grotesk display)', async () => {
      const fonts = await pageA.evaluate(() => {
        const brand = [...document.querySelectorAll('span')].find((s) => s.textContent === 'Hash');
        return {
          body: getComputedStyle(document.body).fontFamily,
          brand: brand ? getComputedStyle(brand).fontFamily : '',
        };
      });
      if (!/Inter/.test(fonts.body)) throw new Error(`body font: ${fonts.body}`);
      if (!/Space Grotesk/.test(fonts.brand)) throw new Error(`display font: ${fonts.brand}`);
    });

    log('\n— cross-tab live KYC updates (page A is NEVER reloaded)');
    const popupPromise = context.waitForEvent('page');
    await pageA.getByRole('button', { name: /Start verification/ }).click();
    const pageB = await popupPromise;
    await pageB.waitForLoadState('domcontentloaded');
    await check('hosted KYC simulator opens in a second tab', () => waitText(pageB, /Bridge Hosted KYC/));
    await pageB.getByRole('button', { name: /Complete verification/ }).click();
    await check('page A flips to under_review live', () =>
      waitText(pageA, /Verification under review/, 15_000),
    );
    await check("page A flips to verified live (~5s simulated webhook)", () =>
      waitText(pageA, /You're verified/, 25_000),
    );
    await check('endorsements render on page A', async () => {
      await waitText(pageA, /SEPA/);
      await waitText(pageA, /Pix/);
    });

    log('\n— dashboard overview (KPIs) + banks: dynamic per-rail form');
    await pageA.getByRole('button', { name: /Continue to dashboard/ }).click();
    await pageA.waitForURL('**/dashboard', { timeout: 30_000 });
    await check('overview renders the KPI row', () => waitText(pageA, /Volume converted/));
    await pageA.goto(`${BASE}/dashboard/banks`);
    await pageA.getByRole('button', { name: /Add bank account/ }).first().click();
    let dialog = pageA.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: 'visible' });
    await dialog.locator('[data-slot="select-trigger"]').first().click();
    await pageA.getByRole('option', { name: /BRL/ }).click();
    await check('BRL switches the form to Pix fields', () => waitText(pageA, /Pix key type/));
    await dialog.locator('#account_holder_name').fill('E2E Bot');
    await dialog.locator('#pix_key').fill('123');
    await dialog.getByRole('button', { name: /Add bank account/ }).click();
    await check('invalid CPF shows an inline error', () => waitText(pageA, /CPF must be 11 digits/));
    await dialog.locator('#pix_key').fill('12345678901');
    await dialog.getByRole('button', { name: /Add bank account/ }).click();
    await check('valid Pix account appears as a card', async () => {
      await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
      await waitText(pageA, /12345678901/);
    });

    await pageA.getByRole('button', { name: /Add bank account/ }).first().click();
    dialog = pageA.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: 'visible' });
    await dialog.locator('#account_holder_name').fill('E2E Bot');
    await dialog.locator('#bank_name').fill('Lead Bank');
    await dialog.locator('#routing_number').fill('021000021');
    await dialog.locator('#account_number').fill('987654321');
    await dialog.getByRole('button', { name: /Add bank account/ }).click();
    await check('USD/ACH account added (default rail)', async () => {
      await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
      await waitText(pageA, /Lead Bank/);
    });

    log('\n— convert: toast, disabled button, cancel while awaiting_funds');
    await pageA.goto(`${BASE}/dashboard/convert`);
    await pageA.fill('#send-amount', '100');
    await check('receive amount is computed from the live rate', () =>
      pageA.waitForFunction(
        () =>
          [...document.querySelectorAll('div')].some(
            (el) => typeof el.className === 'string' && el.className.includes('text-3xl') && /[1-9]/.test(el.textContent || ''),
          ),
        null,
        { timeout: 15_000 },
      ),
    );
    await pageA.getByRole('button', { name: /Confirm transfer/ }).click();
    await check('persistent processing toast appears', () =>
      waitText(pageA, /Transaction processing.*Awaiting Bridge API webhook confirmation/),
    );
    await check('confirm button becomes a disabled spinner', async () => {
      const button = pageA.getByRole('button', { name: /Awaiting webhook confirmation/ });
      await button.waitFor({ state: 'visible', timeout: 15_000 });
      if (!(await button.isDisabled())) throw new Error('button is not disabled');
    });
    await check('cancel is offered while awaiting_funds', () => waitText(pageA, /Cancel transfer/));
    await pageA.getByRole('button', { name: /Cancel transfer/ }).first().click();
    dialog = pageA.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /Cancel transfer/ }).click();
    await check('transfer cancels with toast + Canceled badge', async () => {
      await waitText(pageA, /Transfer canceled/);
      await waitText(pageA, /Cancelado/);
    });
    await check('cancel button disappears once not awaiting_funds', async () => {
      await pageA
        .getByRole('button', { name: /^Cancel transfer$/ })
        .first()
        .waitFor({ state: 'hidden', timeout: 10_000 });
    });

    log('\n— convert: happy path to Completed via simulated webhooks');
    await pageA.getByRole('button', { name: /Confirm transfer/ }).click();
    await check('reaches Completed with a success toast (~7s)', () =>
      waitText(pageA, /Transfer completed — funds delivered/, 35_000),
    );

    log('\n— receive fiat: VA instructions + deposit ledger + endorsement map');
    await pageA.goto(`${BASE}/dashboard/receive`);
    await check('receive screen covers the 6 fiat currencies', async () => {
      await waitText(pageA, /Receive fiat/);
      await waitText(pageA, /GBP · British Pound/);
      await waitText(pageA, /COP · Colombian Peso/);
      await waitText(pageA, /endorsement: faster_payments/);
    });
    await check('USD VA shows live deposit ledger entries', () =>
      waitText(pageA, /Extrato de depósitos/),
    );

    log('\n— backoffice (ops console) over the same data');
    await pageA.goto(`${BASE}/admin/login`);
    await check('ops sign-in works', async () => {
      await pageA.fill('#password', 'hash-admin-2026');
      await pageA.getByRole('button', { name: /Sign in/ }).click();
      await pageA.waitForURL('**/admin', { timeout: 30_000 });
      await waitText(pageA, /Operations overview/);
    });
    await check('ops KPIs reflect settled volume', () => waitText(pageA, /Volume settled/));
    await check('KYC queue lists the customer', async () => {
      await pageA.goto(`${BASE}/admin/kyc`);
      await waitText(pageA, /E2E Bot/);
    });
    await check('webhook log has simulated deliveries', async () => {
      await pageA.goto(`${BASE}/admin/webhooks`);
      await waitText(pageA, /transfer.updated.status_transitioned/);
    });
    await check('email outbox queued the completed-transfer notice', async () => {
      await pageA.goto(`${BASE}/admin/emails`);
      await waitText(pageA, /Your transfer was completed/);
    });
    await check('idempotency audit shows the 24h key ledger', async () => {
      await pageA.goto(`${BASE}/admin/idempotency`);
      await waitText(pageA, /Active/);
    });

    log(failures === 0 ? '\nE2E: ALL CHECKS PASSED\n' : `\nE2E: ${failures} CHECK(S) FAILED\n`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
