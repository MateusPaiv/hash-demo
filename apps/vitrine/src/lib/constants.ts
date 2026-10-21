import type { Currency, FiatCurrency } from '@hash/shared';

/** Platform take-rate applied to every transfer (mirrors Bridge's developer_fee). */
export const DEVELOPER_FEE_PERCENT = '1.0';

export const FIAT_CURRENCIES: readonly FiatCurrency[] = ['usd', 'eur', 'gbp', 'mxn', 'brl', 'cop'] as const;

export const CURRENCY_LABEL: Record<Currency, string> = {
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  mxn: 'MXN',
  brl: 'BRL',
  cop: 'COP',
  usdc: 'USDC',
};

export const CURRENCY_NAME: Record<Currency, string> = {
  usd: 'US Dollar',
  eur: 'Euro',
  gbp: 'British Pound',
  mxn: 'Mexican Peso',
  brl: 'Brazilian Real',
  cop: 'Colombian Peso',
  usdc: 'USDC · Base',
};

export function isFiat(currency: Currency): currency is FiatCurrency {
  return currency !== 'usdc';
}
