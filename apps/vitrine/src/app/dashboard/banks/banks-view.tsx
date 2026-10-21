'use client';

import { useState } from 'react';
import { Landmark, Plus } from 'lucide-react';
import { client } from '@/lib/api/client';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { BankCard } from '@/components/banks/bank-card';
import { AddBankDialog } from '@/components/banks/add-bank-dialog';

export function BanksView() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: accounts, loading } = useRealtimeQuery('external_accounts', () =>
    client.externalAccounts.list(),
  );

  const addButton = (
    <Button onClick={() => setAddOpen(true)}>
      <Plus className="size-4" />
      Add bank account
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Bank accounts"
        description="External accounts that receive your fiat payouts — ACH, Wire, IBAN, CLABE and Pix."
        actions={addButton}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank accounts yet"
          description="Link your first external account to off-ramp crypto into fiat, in any of the supported rails."
          action={addButton}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <BankCard key={account.id} account={account} />
          ))}
        </div>
      )}

      <AddBankDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
