/**
 * Bridge API (v0) — Exchange rates (GET /exchange_rates).
 */

import type { Currency } from './transfer';

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  /** Mid-market: units of `to` per 1 unit of `from`. */
  mid_rate: string;
  /** Customer buys `to` — slightly fewer units than mid. */
  buy_rate: string;
  /** Other side of the spread — slightly more units than mid. */
  sell_rate: string;
  fetched_at: string;
}
