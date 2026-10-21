'use client';

import { Loader2 } from 'lucide-react';
import { client } from '@/lib/api/client';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { ReceiveView } from '@/components/dashboard/receive-view';

export function ReceiveScreen() {
  const { data: customer } = useRealtimeQuery('customers', () => client.customer.me());

  if (!customer) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <ReceiveView
      approved={customer.status === 'approved'}
      endorsements={customer.endorsements.map((e) => ({ name: e.name, status: e.status }))}
    />
  );
}
