/**
 * Client-facing KPIs for the overview — derived exclusively from real state
 * (transfers, external accounts). Nothing here invents data: zero transfers
 * means zero volume.
 */
import type { Currency, ExternalAccount, Transfer } from '@hash/shared';
import { isTerminalState } from '@hash/shared';
import { referenceUsdRate } from '@/lib/mock/fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

const FAILED_STATES = new Set(['undeliverable', 'returned', 'refund_failed', 'refunded']);

/** USD-equivalent of an amount in the given source currency. */
export function toUsd(amount: string | number, currency: Currency): number {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return 0;
  return value * referenceUsdRate(currency);
}

export interface DashboardMetrics {
  completed: Transfer[];
  inFlight: Transfer[];
  canceled: Transfer[];
  failed: Transfer[];
  totalVolumeUsd: number;
  monthVolumeUsd: number;
  feesUsd: number;
}

export function computeDashboardMetrics(transfers: Transfer[]): DashboardMetrics {
  const completed = transfers.filter((t) => t.state === 'payment_processed');
  const inFlight = transfers.filter((t) => !isTerminalState(t.state));
  const canceled = transfers.filter((t) => t.state === 'canceled');
  const failed = transfers.filter((t) => FAILED_STATES.has(t.state));

  const sumUsd = (items: Transfer[], field: 'amount' | 'developer_fee') =>
    items.reduce((acc, t) => acc + toUsd(t[field], t.source.currency), 0);

  const cutoff = Date.now() - 30 * DAY_MS;
  const recentCompleted = completed.filter((t) => Date.parse(t.created_at) >= cutoff);

  return {
    completed,
    inFlight,
    canceled,
    failed,
    totalVolumeUsd: sumUsd(completed, 'amount'),
    monthVolumeUsd: sumUsd(recentCompleted, 'amount'),
    feesUsd: sumUsd(completed, 'developer_fee'),
  };
}

export interface DayVolume {
  label: string;
  usd: number;
}

/** USD volume of completed transfers per day over the last `days` days. */
export function volumeByDay(transfers: Transfer[], days = 14): DayVolume[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number>();
  const order: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = day.toDateString();
    order.push({
      key,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(day),
    });
    buckets.set(key, 0);
  }

  for (const transfer of transfers) {
    if (transfer.state !== 'payment_processed') continue;
    const day = new Date(Date.parse(transfer.created_at));
    day.setHours(0, 0, 0, 0);
    const key = day.toDateString();
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + toUsd(transfer.amount, transfer.source.currency));
    }
  }

  return order.map(({ key, label }) => ({ label, usd: buckets.get(key) ?? 0 }));
}
