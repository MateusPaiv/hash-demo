'use client';

import { KeyRound, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { formatDateTime, truncateMiddle } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

export function IdempotencyAudit() {
  const { data: rows, loading } = useRealtimeQuery('transfers', () => adminApi.idempotency.list());

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Idempotency audit
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every Bridge-bound POST is wrapped in a 24h key. Conflicts (reused key, different body)
        surface as webhooks with type <span className="font-mono">idempotency.conflict</span>.
      </p>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={KeyRound}
            title="No idempotency keys yet"
            description="Create a transfer in the client app to see the key ledger."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <Card key={row.key} className="rounded-xl border-neutral-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-neutral-900">
                    {truncateMiddle(row.key, 8, 4)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {row.endpoint} · resource{' '}
                    <span className="font-mono">{truncateMiddle(row.resource_id ?? '—', 6, 4)}</span>
                  </p>
                </div>
                <div className="text-right text-xs text-neutral-500">
                  <p>created {formatDateTime(row.created_at)}</p>
                  <p>expires {formatDateTime(row.expires_at)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`rounded-lg text-[10px] uppercase ${
                    row.expired ? 'border-red-200 bg-red-50 text-red-600' : ''
                  }`}
                >
                  {row.expired ? 'Expired' : 'Active'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
