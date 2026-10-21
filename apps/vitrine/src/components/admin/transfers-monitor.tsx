'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Ban, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TransferState } from '@hash/shared';
import { CANCELLABLE_TRANSFER_STATES } from '@hash/shared';
import { adminApi, ApiError } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { CURRENCY_LABEL } from '@/lib/constants';
import { formatAmount, formatDateTime, truncateMiddle } from '@/lib/format';
import { TransferStateBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

const ALL_STATES: TransferState[] = [
  'awaiting_funds', 'in_review', 'funds_received', 'payment_submitted',
  'payment_processed', 'canceled', 'undeliverable', 'returned',
  'refund_in_flight', 'refund_failed', 'refunded',
];

export function TransfersMonitor() {
  const { data: rows, loading } = useRealtimeQuery('transfers', () => adminApi.transfers.list());
  const [filter, setFilter] = useState<TransferState | 'all'>('all');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const filtered = useMemo(
    () => rows?.filter((row) => filter === 'all' || row.transfer.state === filter) ?? [],
    [rows, filter],
  );

  const opsCancel = async () => {
    if (!cancelId) return;
    try {
      await adminApi.transfers.cancel(cancelId);
      toast.success('Transfer canceled (audit event + email queued)');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Cancel failed');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Transfers
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every transfer on the platform, all 11 states, with ops cancel for funds still awaiting.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          All
        </button>
        {ALL_STATES.map((state) => (
          <button
            key={state}
            onClick={() => setFilter(state)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === state
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {state}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ArrowLeftRight}
            title="Nothing here"
            description={filter === 'all' ? 'No transfers on the platform yet.' : `No transfers currently in state "${filter}".`}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map(({ transfer, customer_email }) => (
            <Card key={transfer.id} className="rounded-xl border-neutral-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">
                    {formatAmount(transfer.amount, transfer.source.currency)}{' '}
                    <span className="text-neutral-400">→</span>{' '}
                    {CURRENCY_LABEL[transfer.destination.currency]}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {customer_email} · fee {formatAmount(transfer.developer_fee, transfer.source.currency)} ·{' '}
                    {formatDateTime(transfer.created_at)}
                  </p>
                </div>
                {transfer.receipt?.transaction_hash ? (
                  <button
                    className="flex items-center gap-1 font-mono text-xs text-neutral-500 hover:text-neutral-900"
                    onClick={() => {
                      navigator.clipboard.writeText(transfer.receipt!.transaction_hash!);
                      toast.success('Transaction hash copied');
                    }}
                  >
                    <Copy className="size-3" />
                    {truncateMiddle(transfer.receipt.transaction_hash)}
                  </button>
                ) : null}
                {(CANCELLABLE_TRANSFER_STATES as readonly string[]).includes(transfer.state) ? (
                  <Button variant="outline" size="sm" onClick={() => setCancelId(transfer.id)}>
                    <Ban className="size-4 text-red-500" />
                    Cancel
                  </Button>
                ) : null}
                <TransferStateBadge state={transfer.state} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={cancelId != null}
        onOpenChange={(open) => (open ? null : setCancelId(null))}
        icon={Ban}
        title="Cancel this transfer?"
        description="Ops cancel mirrors the customer-side rule: only possible while awaiting funds."
        confirmLabel="Cancel transfer"
        onConfirm={opsCancel}
      />
    </div>
  );
}
