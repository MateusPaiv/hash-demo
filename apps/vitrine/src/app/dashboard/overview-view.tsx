'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { client } from '@/lib/api/client';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { CURRENCY_LABEL } from '@/lib/constants';
import { formatAmount, formatDateTime } from '@/lib/format';
import { computeDashboardMetrics, volumeByDay } from '@/lib/metrics';
import { PageHeader } from '@/components/shared/page-header';
import { KycBanner } from '@/components/shared/kyc-banner';
import { TransferStateBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { VolumeChart } from '@/components/dashboard/volume-chart';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function StatusRow({
  icon: Icon,
  label,
  count,
  className,
}: {
  icon: typeof Clock;
  label: string;
  count: number;
  className: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm text-neutral-700">
        <Icon className={`size-4 ${className}`} />
        {label}
      </span>
      <span className="font-display text-sm font-semibold tabular-nums text-neutral-900">
        {count}
      </span>
    </div>
  );
}

export function OverviewView() {
  const { data: customer, loading: customerLoading } = useRealtimeQuery('customers', () =>
    client.customer.me(),
  );
  const { data: accounts } = useRealtimeQuery('external_accounts', () =>
    client.externalAccounts.list(),
  );
  const { data: transfers, loading: transfersLoading } = useRealtimeQuery('transfers', () =>
    client.transfers.list(),
  );

  if (customerLoading || transfersLoading || !customer) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const metrics = computeDashboardMetrics(transfers ?? []);
  const days = volumeByDay(transfers ?? []);
  const rails = [...new Set((accounts ?? []).map((a) => a.rail))]
    .map((rail) => rail.toUpperCase())
    .join(', ');

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Your fiat and USDC activity at a glance."
        actions={
          <Link href="/dashboard/convert" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowDownUp className="size-4" />
            New conversion
          </Link>
        }
      />

      {customer.status !== 'approved' ? <KycBanner status={customer.status} /> : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Volume converted"
          value={formatAmount(metrics.totalVolumeUsd.toFixed(2), 'usd')}
          sub={`+${formatAmount(metrics.monthVolumeUsd.toFixed(2), 'usd')} in the last 30 days`}
        />
        <KpiCard
          icon={Clock}
          label="Completed transfers"
          value={String(metrics.completed.length)}
          sub={
            metrics.inFlight.length > 0
              ? `${metrics.inFlight.length} in progress right now`
              : 'All transfers settled'
          }
        />
        <KpiCard
          icon={Receipt}
          label="Fees paid"
          value={formatAmount(metrics.feesUsd.toFixed(2), 'usd')}
          sub="1% platform take on each transfer"
        />
        <KpiCard
          icon={Landmark}
          label="Linked accounts"
          value={String(accounts?.length ?? 0)}
          sub={rails || 'Link your first bank account'}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* Volume chart */}
        <Card className="rounded-xl border-neutral-200 shadow-sm lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Volume — last 14 days</h2>
              <span className="text-xs text-neutral-500">completed transfers, USD equivalent</span>
            </div>
            {metrics.completed.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 py-14 text-center">
                <ArrowDownUp className="mb-3 size-5 text-neutral-300" />
                <p className="text-sm text-neutral-500">
                  No conversions yet — your daily volume will chart here.
                </p>
                <Link
                  href="/dashboard/convert"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
                >
                  Make your first conversion
                </Link>
              </div>
            ) : (
              <VolumeChart data={days} />
            )}
          </CardContent>
        </Card>

        {/* Transfer status breakdown */}
        <Card className="rounded-xl border-neutral-200 shadow-sm">
          <CardContent className="space-y-2.5 p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-neutral-900">Transfer status</h2>
            <StatusRow
              icon={Clock}
              label="In progress"
              count={metrics.inFlight.length}
              className="text-blue-600"
            />
            <StatusRow
              icon={CheckCircle2}
              label="Completed"
              count={metrics.completed.length}
              className="text-emerald-600"
            />
            <StatusRow
              icon={AlertTriangle}
              label="Returned or failed"
              count={metrics.failed.length}
              className="text-amber-500"
            />
            <StatusRow
              icon={ArrowDownUp}
              label="Canceled"
              count={metrics.canceled.length}
              className="text-neutral-400"
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <section className="mt-6">
        <Card className="rounded-xl border-neutral-200 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Recent activity</h2>
              <Link
                href="/dashboard/convert"
                className="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>

            {!transfers || transfers.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">
                Nothing here yet — this feed fills up live as transfers settle.
              </p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {transfers.slice(0, 5).map((transfer) => (
                  <div key={transfer.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="rounded-xl bg-neutral-100 p-2.5">
                      <ArrowDownUp className="size-4 text-neutral-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {formatAmount(transfer.amount, transfer.source.currency)}{' '}
                        <span className="text-neutral-400">→</span>{' '}
                        {CURRENCY_LABEL[transfer.destination.currency]}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDateTime(transfer.created_at)}
                      </p>
                    </div>
                    <TransferStateBadge state={transfer.state} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
