'use client';

import { AlertTriangle, Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, ApiError } from '@/lib/api/admin';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

const TEMPLATE_LABEL: Record<string, string> = {
  'transfer.completed': 'Completed receipt',
  'transfer.canceled': 'Cancellation notice',
  'transfer.refunded': 'Refund notice',
};

export function EmailOutbox() {
  const { data: rows, loading } = useRealtimeQuery('email_outbox', () => adminApi.emails.list());

  const send = async (id: string) => {
    try {
      await adminApi.emails.send(id);
      toast.success('Queued → sent (Resend wiring pending the API key)');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Send failed');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Transactional emails
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        One notification per terminal transfer state — completed, canceled or refunded.
      </p>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Pipeline is real from queue to UI; the Resend HTTP call activates with{' '}
          <span className="font-mono text-xs">RESEND_API_KEY</span> in the Cofre.
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Mail}
            title="Outbox is empty"
            description="Transfers that reach a terminal state queue their customer notification here."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="rounded-xl border-neutral-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="rounded-xl bg-neutral-100 p-2.5">
                  <Mail className="size-4 text-neutral-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{row.subject}</p>
                  <p className="truncate text-xs text-neutral-500">
                    to {row.to} · {formatDateTime(row.created_at)}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-lg text-[10px] uppercase">
                  {TEMPLATE_LABEL[row.template] ?? row.template}
                </Badge>
                <Badge
                  variant="outline"
                  className={`rounded-lg text-[10px] uppercase ${
                    row.status === 'sent'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {row.status}
                </Badge>
                {row.status === 'queued' ? (
                  <Button variant="outline" size="sm" onClick={() => send(row.id)}>
                    <Send className="size-3.5" />
                    Send
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
