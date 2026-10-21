'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Clock, Copy, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import type { Transfer } from '@hash/shared';
import { isCancellable, isTerminalState } from '@hash/shared';
import { client } from '@/lib/api/client';
import { pendingToasts } from '@/lib/pending-toasts';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { CURRENCY_LABEL, isFiat } from '@/lib/constants';
import { formatAmount, formatDateTime, truncateMiddle } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { TransferStateBadge } from '@/components/shared/status-badge';
import { SwapWidget } from '@/components/convert/swap-widget';
import { TransferStatusTimeline } from '@/components/convert/transfer-status-timeline';
import { CancelTransferButton } from '@/components/convert/cancel-transfer-dialog';
import { KycBanner } from '@/components/shared/kyc-banner';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

function DepositInstructions({ transfer }: { transfer: Transfer }) {
  const { data: virtualAccounts } = useRealtimeQuery('virtual_accounts', () =>
    client.virtualAccounts.mine(),
  );
  const va = virtualAccounts?.find((v) => v.currency === transfer.source.currency);
  if (!va) return null;
  const instructions = va.deposit_instructions;
  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-blue-900">
        <Landmark className="size-4" />
        Send {CURRENCY_LABEL[transfer.source.currency]} to fund this transfer
      </p>
      <div className="grid gap-1 font-mono text-xs text-blue-900/80">
        <span>{instructions.bank_name}</span>
        {instructions.routing_number ? <span>Routing · {instructions.routing_number}</span> : null}
        {instructions.account_number ? <span>Account · {instructions.account_number}</span> : null}
      </div>
    </div>
  );
}

export function ConvertView() {
  const { data: customer } = useRealtimeQuery('customers', () => client.customer.me());
  const { data: accounts } = useRealtimeQuery('external_accounts', () =>
    client.externalAccounts.list(),
  );
  const { data: transfers, loading } = useRealtimeQuery('transfers', () => client.transfers.list());

  // Bridges the gap between the create-response and the next list refetch.
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  // Newest in-flight transfer, if any — derived from the list so the
  // "processing" card and the locked confirm button survive navigating
  // away and back (component state would not).
  const liveTransfer = useMemo(
    () => transfers?.find((t) => !isTerminalState(t.state)) ?? null,
    [transfers],
  );
  const pendingTransferId = liveTransfer?.id ?? justCreatedId;

  // Resolve every "awaiting webhook" toast this tab owns once its transfer
  // settles. The registry survives navigation, so an orphaned toast is still
  // resolved on return instead of spinning forever.
  useEffect(() => {
    if (!transfers) return;
    for (const transfer of transfers) {
      if (!isTerminalState(transfer.state) || !pendingToasts.take(transfer.id)) continue;
      switch (transfer.state) {
        case 'payment_processed':
          toast.success('Transfer completed — funds delivered', { id: transfer.id });
          break;
        case 'canceled':
          toast.info('Transfer canceled', { id: transfer.id });
          break;
        case 'refunded':
          toast.info('Transfer refunded', { id: transfer.id });
          break;
        default:
          toast.error('Transfer could not be delivered and was flagged for review', {
            id: transfer.id,
          });
      }
      setJustCreatedId((current) => (current === transfer.id ? null : current));
    }
  }, [transfers]);

  const kycApproved = customer?.status === 'approved';

  return (
    <div>
      <PageHeader
        title="Convert"
        description="Swap between fiat and USDC on Base — rates refresh live, fees shown upfront."
      />

      {customer && !kycApproved ? <KycBanner status={customer.status} /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <SwapWidget
            accounts={accounts ?? []}
            kycApproved={kycApproved}
            pendingTransferId={pendingTransferId}
            onPendingChange={(transfer) => setJustCreatedId(transfer?.id ?? null)}
          />
        </div>

        <div className="space-y-6">
          {/* Live transfer being confirmed via webhook */}
          {liveTransfer ? (
            <Card className="rounded-xl border-neutral-900/10 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                    <Clock className="size-4 text-amber-500" />
                    Processing transfer
                  </h2>
                  <TransferStateBadge state={liveTransfer.state} />
                </div>
                <p className="mb-5 text-sm text-neutral-500">
                  {formatAmount(liveTransfer.amount, liveTransfer.source.currency)} →{' '}
                  {CURRENCY_LABEL[liveTransfer.destination.currency]} · updates live as Bridge
                  webhooks arrive
                </p>
                <TransferStatusTimeline state={liveTransfer.state} />
                {isFiat(liveTransfer.source.currency) ? (
                  <DepositInstructions transfer={liveTransfer} />
                ) : null}
                {isCancellable(liveTransfer.state) ? (
                  <>
                    <Separator className="my-4" />
                    <CancelTransferButton transferId={liveTransfer.id} />
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Recent transfers */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Recent transfers</h2>
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : !transfers || transfers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
                <ArrowDownUp className="mx-auto mb-3 size-5 text-neutral-300" />
                <p className="text-sm text-neutral-500">
                  No transfers yet — your conversions will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.slice(0, 6).map((transfer) => (
                  <Card key={transfer.id} className="rounded-xl border-neutral-200 shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="rounded-xl bg-neutral-100 p-2.5">
                        <ArrowDownUp className="size-4 text-neutral-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">
                          {formatAmount(transfer.amount, transfer.source.currency)}{' '}
                          <span className="text-neutral-400">→</span>{' '}
                          {CURRENCY_LABEL[transfer.destination.currency]}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                          <span>{formatDateTime(transfer.created_at)}</span>
                          <span>·</span>
                          <span>fee {formatAmount(transfer.developer_fee, transfer.source.currency)}</span>
                          {transfer.receipt?.transaction_hash ? (
                            <>
                              <span>·</span>
                              <button
                                className="inline-flex items-center gap-1 font-mono hover:text-neutral-900"
                                onClick={() => {
                                  navigator.clipboard.writeText(transfer.receipt!.transaction_hash!);
                                  toast.success('Transaction hash copied');
                                }}
                              >
                                <Copy className="size-3" />
                                {truncateMiddle(transfer.receipt.transaction_hash)}
                              </button>
                            </>
                          ) : null}
                        </p>
                      </div>
                      {isCancellable(transfer.state) ? (
                        <CancelTransferButton transferId={transfer.id} />
                      ) : null}
                      <TransferStateBadge state={transfer.state} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
