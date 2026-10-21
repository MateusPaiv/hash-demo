'use client';

import { Loader2, RotateCcw, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerStatus, TransferState } from '@hash/shared';
import { adminApi } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { formatDateTime, truncateMiddle } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { CustomerStatusBadge, TransferStateBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

export function WebhookLog() {
  const { data: events, loading } = useRealtimeQuery('webhook_events', () =>
    adminApi.webhooks.list(),
  );

  const replay = async (eventId: string) => {
    const result = await adminApi.webhooks.replay(eventId);
    switch (result.reason) {
      case 'applied':
        toast.success('Delivery replayed — object advanced');
        break;
      case 'duplicate':
        toast.info('Duplicate delivery ignored — dedupe works');
        break;
      case 'obsolete':
        toast.info('Event is obsolete — object is already ahead of it');
        break;
      default:
        toast.error('Replay failed — event or object not found');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Webhook delivery log
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Internal audit trail — every (simulated) Bridge delivery, deduped by event_id, replayable.
      </p>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : !events || events.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Webhook}
            title="No deliveries yet"
            description="Run a transfer or KYC decision in the client app — each state transition lands here as an event."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((event) => (
            <Card key={event.event_id} className="rounded-xl border-neutral-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-neutral-900">{event.event_type}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    <span className="font-mono">{truncateMiddle(event.event_object_id, 6, 4)}</span> ·{' '}
                    {formatDateTime(event.received_at)} ·{' '}
                    <span className="font-mono">{truncateMiddle(event.event_id, 6, 4)}</span>
                  </p>
                </div>
                <Badge variant="outline" className="rounded-lg text-[10px] uppercase">
                  {event.event_category}
                </Badge>
                {event.event_object_status ? (
                  event.event_category === 'transfer' ? (
                    <TransferStateBadge state={event.event_object_status as TransferState} />
                  ) : (
                    <CustomerStatusBadge status={event.event_object_status as CustomerStatus} />
                  )
                ) : null}
                <Badge
                  variant="outline"
                  className="rounded-lg text-[10px] uppercase"
                >
                  {event.delivery}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => replay(event.event_id)}>
                  <RotateCcw className="size-3.5" />
                  Replay
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
