/**
 * Deterministic fixtures + small generators for the mock backend.
 * Generators (ids, hashes) must only run in the browser, inside
 * effects/handlers — never during prerender.
 */
import type { Currency, FiatCurrency } from '@hash/shared';

/** Mid-market reference rates (mock). Keys are `from:to`. */
const BASE_RATES: Partial<Record<`${Currency}:${Currency}`, number>> = {
  'usd:usdc': 0.9985,
  'usdc:usd': 0.999,
  'eur:usdc': 1.0842,
  'usdc:eur': 0.9145,
  'mxn:usdc': 0.0548,
  'usdc:mxn': 18.05,
  'brl:usdc': 0.1762,
  'usdc:brl': 5.62,
  'gbp:usdc': 1.2712,
  'usdc:gbp': 0.7821,
  'cop:usdc': 0.00025,
  'usdc:cop': 4050,
};

/** Base rate ±0.1% jitter so refetches feel live. */
export function jitteredRate(from: Currency, to: Currency): number | null {
  const base = BASE_RATES[`${from}:${to}`];
  if (base == null) return null;
  return base * (1 + (Math.random() - 0.5) * 0.002);
}

/**
 * Stable USD-equivalent of one unit of `currency` (no jitter — KPIs should not
 * wobble between renders). USDC ≈ USD parity.
 */
export function referenceUsdRate(currency: Currency): number {
  switch (currency) {
    case 'usd':
    case 'usdc':
      return 1;
    default:
      return BASE_RATES[`${currency}:usdc`] ?? 1;
  }
}

/** 5 bps around mid. `buy` is the customer rate (fewer units of `to`). */
export function quotedRates(
  from: Currency,
  to: Currency,
): { mid: number; buy: number; sell: number } | null {
  const mid = jitteredRate(from, to);
  if (mid == null) return null;
  return { mid, buy: mid * 0.9995, sell: mid * 1.0005 };
}

/** The Bridge payment rail a fiat currency moves on. */
export function railForFiat(
  currency: FiatCurrency,
): 'ach' | 'sepa' | 'spei' | 'pix' | 'faster_payments' | 'bank_transfer_co' {
  switch (currency) {
    case 'usd':
      return 'ach';
    case 'eur':
      return 'sepa';
    case 'mxn':
      return 'spei';
    case 'brl':
      return 'pix';
    case 'gbp':
      return 'faster_payments';
    case 'cop':
      return 'bank_transfer_co';
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function generateTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function generateAccountNumber(): string {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}
