import type { Currency } from '@hash/shared';
import { isFiat } from './constants';

/** "1234.5" + usd → "$1,234.50" · usdc → "1,234.50 USDC" */
export function formatAmount(amount: string | number, currency: Currency, maximumFractionDigits = 2): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  if (isFiat(currency)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits,
    }).format(value);
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)} USDC`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "021000021" → "••••0021", "0x71C7…97F" style masking for sensitive numbers. */
export function maskTail(value: string, visible = 4): string {
  if (value.length <= visible) return value;
  return `••••${value.slice(-visible)}`;
}

export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
