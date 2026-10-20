/**
 * Bridge API (v0) — Exchange rates (GET /exchange_rates).
 */

import type { Currency } from './transfer';

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  /** Mid-market rate as a decimal string, e.g. "0.9985". */
  mid_rate: string;
  fetched_at: string;
}
