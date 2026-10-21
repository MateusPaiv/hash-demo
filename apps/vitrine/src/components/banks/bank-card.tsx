'use client';

import { useState } from 'react';
import { Building2, Globe2, Landmark, Power, QrCode, RotateCcw, Zap, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ExternalAccount, ExternalAccountRail } from '@hash/shared';
import { client, ApiError } from '@/lib/api/client';
import { maskTail, truncateMiddle } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RAIL_LABEL } from './rail-config';

const RAIL_ICON: Record<ExternalAccountRail, LucideIcon> = {
  ach: Landmark,
  wire: Landmark,
  iban: Globe2,
  faster_payments: Zap,
  clabe: Building2,
  pix: QrCode,
  bank_transfer_co: Building2,
};

function detailLines(account: ExternalAccount): string[] {
  switch (account.rail) {
    case 'ach':
      return [
        `Routing ${maskTail(account.routing_number)}`,
        `Account ${maskTail(account.account_number)}`,
        account.account_subtype === 'checking' ? 'Checking' : 'Savings',
      ];
    case 'wire':
      return [`Routing ${maskTail(account.routing_number)}`, `Account ${maskTail(account.account_number)}`];
    case 'iban':
      return [`IBAN ${maskTail(account.iban)}`, `BIC ${account.bic}`];
    case 'faster_payments':
      return [`Sort code ${maskTail(account.sort_code)}`, `Account ${maskTail(account.account_number)}`];
    case 'clabe':
      return [`CLABE ${maskTail(account.clabe)}`];
    case 'pix':
      return [`${account.pix_key_type.toUpperCase()} · ${truncateMiddle(account.pix_key, 8, 4)}`];
    case 'bank_transfer_co':
      return [
        `Account ${maskTail(account.account_number)}`,
        account.account_subtype === 'checking' ? 'Checking' : 'Savings',
      ];
  }
}

export function BankCard({ account }: { account: ExternalAccount }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const Icon = RAIL_ICON[account.rail];
  const deactivated = account.status === 'deactivated';

  const deactivate = async () => {
    setPending(true);
    try {
      await client.externalAccounts.deactivate(account.id);
      toast.success('Account deactivated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not deactivate');
    } finally {
      setPending(false);
    }
  };

  const reactivate = async () => {
    setPending(true);
    try {
      await client.externalAccounts.reactivate(account.id);
      toast.success('Account reactivated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not reactivate');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Card
        className={
          deactivated
            ? 'rounded-xl border-neutral-200 bg-white opacity-60 shadow-sm'
            : 'rounded-xl border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md'
        }
      >
        <CardContent className="flex items-start gap-4 p-5">
          <div className="rounded-xl bg-neutral-100 p-2.5">
            <Icon className="size-5 text-neutral-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-neutral-900">{account.bank_name}</p>
              <Badge variant="outline" className="rounded-lg text-[10px] uppercase tracking-wide">
                {account.currency}
              </Badge>
              {deactivated ? (
                <Badge variant="outline" className="rounded-lg border-amber-200 bg-amber-50 text-[10px] uppercase text-amber-700">
                  Inactive
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{account.account_holder_name}</p>
            <div className="mt-2 space-y-0.5">
              {detailLines(account).map((line) => (
                <p key={line} className="font-mono text-xs text-neutral-500">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {RAIL_LABEL[account.rail]}
            </p>
          </div>
          {deactivated ? (
            <Button variant="outline" size="sm" onClick={reactivate} disabled={pending}>
              <RotateCcw className="size-4" />
              Reactivate
            </Button>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Deactivate bank account"
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
            >
              <Power className="size-4" />
            </button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={Power}
        title="Deactivate bank account?"
        description={`${account.bank_name} (${RAIL_LABEL[account.rail]}) stops receiving payouts. Deletion is a later-phase action — this can be reversed at any time.`}
        confirmLabel="Deactivate"
        onConfirm={deactivate}
      />
    </>
  );
}
