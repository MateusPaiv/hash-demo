'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminCustomerRow, ApiError } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { CustomerStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { UserX } from 'lucide-react';

export function KycQueue() {
  const { data: rows, loading } = useRealtimeQuery('customers', () => adminApi.customers.list());

  const decide = async (row: AdminCustomerRow, outcome: 'approved' | 'rejected') => {
    try {
      await adminApi.customers.decide(row.user_id, outcome);
      toast.success(`Customer ${outcome} — webhook delivery simulated`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Decision failed');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        KYC review queue
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every customer and their endorsement state. Decisions here play the role of the Bridge
        decision webhook.
      </p>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState icon={UserX} title="No customers yet" description="Sign someone up in the client app and refresh this view." />
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <Card key={row.user_id} className="rounded-xl border-neutral-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {row.customer.full_name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {row.user_email} · {row.accounts} bank account(s) · {row.transfers} transfer(s)
                  </p>
                </div>
                <CustomerStatusBadge status={row.customer.status} />
                <div className="flex items-center gap-2">
                  {row.customer.status === 'approved' ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decide(row, 'approved')}
                    >
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Approve
                    </Button>
                  )}
                  {row.customer.status !== 'rejected' && row.customer.status !== 'approved' ? (
                    <Button variant="outline" size="sm" onClick={() => decide(row, 'rejected')}>
                      <XCircle className="size-4 text-red-500" />
                      Reject
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
