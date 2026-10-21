'use client';

import Link from 'next/link';
import { Activity, CircleDollarSign, Loader2, ReceiptText, Users } from 'lucide-react';
import type { CustomerStatus, TransferState } from '@hash/shared';
import { adminApi } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { formatAmount, formatDateTime } from '@/lib/format';
import { CustomerStatusBadge, TransferStateBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_ROWS: CustomerStatus[] = ['not_started', 'incomplete', 'under_review', 'approved', 'rejected'];
const STATE_ROWS: TransferState[] = [
  'awaiting_funds', 'in_review', 'funds_received', 'payment_submitted',
  'payment_processed', 'canceled', 'undeliverable', 'returned',
  'refund_in_flight', 'refund_failed', 'refunded',
];

export function OpsOverview() {
  const { data: metrics } = useRealtimeQuery('transfers', () => adminApi.metrics.global());
  const { data: events } = useRealtimeQuery('webhook_events', () => adminApi.webhooks.list());

  if (!metrics) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const customersTotal = STATUS_ROWS.reduce((acc, s) => acc + metrics.customersByStatus[s], 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Operations overview
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Platform-wide view — every customer, transfer and internal store, live.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Volume settled"
          value={formatAmount(metrics.totalVolumeUsd.toFixed(2), 'usd')}
          sub="all completed transfers, USD-equivalent"
        />
        <KpiCard
          icon={ReceiptText}
          label="Fees accrued"
          value={formatAmount(metrics.feesUsd.toFixed(2), 'usd')}
          sub="1% developer fee, settled only"
        />
        <KpiCard
          icon={Users}
          label="Customers"
          value={String(customersTotal)}
          sub={`${metrics.customersByStatus.approved} approved · ${metrics.customersByStatus.under_review} in review`}
        />
        <KpiCard
          icon={Activity}
          label="Failure rate"
          value={`${(metrics.failureRate * 100).toFixed(1)}%`}
          sub="returned / refunded / undeliverable vs settled"
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border-neutral-200 bg-white shadow-sm lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-neutral-900">Customers by status</h2>
            <div className="space-y-2.5">
              {STATUS_ROWS.map((status) => (
                <div key={status} className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-2.5">
                  <CustomerStatusBadge status={status} />
                  <span className="font-display text-sm font-semibold tabular-nums">
                    {metrics.customersByStatus[status]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-200 bg-white shadow-sm lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-neutral-900">Transfers by state</h2>
            <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {STATE_ROWS.map((state) => (
                <div key={state} className="flex flex-col items-start gap-1 rounded-xl border border-neutral-200 px-3 py-2.5">
                  <TransferStateBadge state={state} />
                  <span className="font-display text-lg font-semibold tabular-nums text-neutral-900">
                    {metrics.transfersByState[state] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-xl border-neutral-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Latest webhook deliveries</h2>
            <Link href="/admin/webhooks" className="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">
              View log
            </Link>
          </div>
          {!events || events.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No deliveries yet — transition anything on the client app and watch this fill live.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {events.slice(0, 5).map((event) => (
                <div key={event.event_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="rounded-xl bg-neutral-100 p-2.5">
                    <Activity className="size-4 text-neutral-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-neutral-900">{event.event_type}</p>
                    <p className="text-xs text-neutral-500">
                      {event.event_category} · {formatDateTime(event.received_at)}
                    </p>
                  </div>
                  {event.event_object_status ? (
                    event.event_category === 'transfer' ? (
                      <TransferStateBadge state={event.event_object_status as TransferState} />
                    ) : (
                      <CustomerStatusBadge status={event.event_object_status as CustomerStatus} />
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
