'use client';

import { useEffect, useState } from 'react';
import { CircleDollarSign, Loader2, ReceiptText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, ApiError } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AdminFees() {
  const [percent, setPercent] = useState<string | null>(null);
  const [payoutAccount, setPayoutAccount] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.fees
      .get()
      .then((config) => {
        setPercent(config.percent);
        setPayoutAccount(config.feePayoutAccount);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (percent == null) return;
    setPending(true);
    try {
      await adminApi.fees.set(percent);
      toast.success('Platform fee updated — the Convert widget picks it up on its next mount');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  if (loading || percent == null) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Platform fees
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Paridade de <span className="font-mono text-xs">GET /developer/fees</span> e{' '}
        <span className="font-mono text-xs">PUT /developer/fees</span> — receita da plataforma por
        transação.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-neutral-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="rounded-xl bg-neutral-100 p-2">
                <CircleDollarSign className="size-4 text-neutral-700" />
              </div>
              <h2 className="text-base font-semibold text-neutral-900">Developer fee (percent)</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fee">Percent per transfer (0–5)</Label>
                <Input
                  id="fee"
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="max-w-40 font-mono"
                />
              </div>
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save fee
              </Button>
              <p className="text-xs text-neutral-500">
                Stored with the platform config; every transfer carries{' '}
                <span className="font-mono">developer_fee</span> computed from this value.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="rounded-xl bg-neutral-100 p-2">
                <ReceiptText className="size-4 text-neutral-700" />
              </div>
              <h2 className="text-base font-semibold text-neutral-900">Fee payout account</h2>
            </div>
            <p className="font-mono text-xs text-neutral-600">{payoutAccount}</p>
            <p className="mt-2 text-xs text-neutral-500">
              Conta que recebe as taxas (
              <span className="font-mono text-xs">/developer/fee_external_account</span>) — fixture
              mock até o Vault live.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
