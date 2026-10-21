'use client';

import { Banknote, Clock, Landmark, Lock, Loader2, ShieldAlert } from 'lucide-react';
import type { FiatCurrency } from '@hash/shared';
import { client, CURRENCY_ENDORSEMENT, ApiError } from '@/lib/api/client';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { CURRENCY_LABEL, CURRENCY_NAME } from '@/lib/constants';
import { formatAmount, formatDateTime } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';

const CURRENCIES: FiatCurrency[] = ['usd', 'eur', 'gbp', 'mxn', 'brl', 'cop'];

function instructionLines(instructions: {
  bank_name: string;
  routing_number?: string;
  account_number?: string;
  iban?: string;
  bic?: string;
  clabe?: string;
  pix_key?: string;
}): string[] {
  const lines: string[] = [];
  if (instructions.routing_number) lines.push(`Routing · ${instructions.routing_number}`);
  if (instructions.account_number) lines.push(`Account · ${instructions.account_number}`);
  if (instructions.iban) lines.push(`IBAN · ${instructions.iban}`);
  if (instructions.bic) lines.push(`BIC · ${instructions.bic}`);
  if (instructions.clabe) lines.push(`CLABE · ${instructions.clabe}`);
  if (instructions.pix_key) lines.push(`Pix key · ${instructions.pix_key}`);
  return lines;
}

/** One currency's virtual account + its deposit ledger + endorsement state. */
function ReceiveCard({ currency, approved, endorsements }: { currency: FiatCurrency; approved: boolean; endorsements: { name: string; status: string }[] }) {
  const needed = CURRENCY_ENDORSEMENT[currency];
  const active = approved && endorsements.some((e) => e.name === needed && e.status === 'approved');
  const { data: accounts, loading } = useRealtimeQuery('virtual_accounts', () =>
    active ? client.virtualAccounts.mine(currency) : Promise.resolve([]),
  );
  const { data: activity } = useRealtimeQuery('virtual_activity', () =>
    client.virtualAccounts.activity(currency),
  );

  const va = accounts?.[0];

  return (
    <Card className="rounded-xl border-neutral-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-neutral-100 p-2">
              <Banknote className="size-4 text-neutral-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {CURRENCY_LABEL[currency]} · {CURRENCY_NAME[currency]}
              </p>
              <p className="text-xs text-neutral-500">endorsement: {needed}</p>
            </div>
          </div>
          {active ? null : (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <ShieldAlert className="size-3.5" />
              Este rail precisa do endorsement
            </div>
          )}
        </div>

        {!approved ? (
          <p className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
            <Lock className="size-3.5" />
            Aprovado? Complete a verificação de identidade primeiro.
          </p>
        ) : !active ? null : loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : !va ? null : (
          <>
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-blue-900">
                <Landmark className="size-4" />
                {va.deposit_instructions.bank_name}
              </p>
              <div className="space-y-0.5 font-mono text-xs break-all text-blue-900/80">
                {instructionLines(va.deposit_instructions).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-blue-700/80">
                Todo depósito recebido aqui é convertido em USDC e enviado ao destino configurado.
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Extrato de depósitos
              </p>
              {!activity || activity.length === 0 ? (
                <p className="py-4 text-center text-xs text-neutral-400">
                  Nenhum depósito ainda — envie fiat para os dados acima.
                </p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {activity.slice(0, 5).map((row) => (
                    <div key={row.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="rounded-lg bg-neutral-100 p-1.5">
                        {row.status === 'pending' ? (
                          <Clock className="size-3.5 text-amber-500" />
                        ) : (
                          <Banknote className="size-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-900">
                          {formatAmount(row.amount, row.currency)}
                          {row.status === 'pending' ? ' · aguardando recebimento' : ' · recebido'}
                        </p>
                        <p className="text-[11px] text-neutral-500">{formatDateTime(row.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReceiveView({ approved, endorsements }: { approved: boolean; endorsements: { name: string; status: string }[] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
        Receive fiat
      </h1>
      <p className="mt-1 mb-6 text-sm text-neutral-500">
        Seus dados bancários para receber fiat — cada depósito vira USDC no destino configurado.
        Endossos ativos por moeda e o que falta.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CURRENCIES.map((currency) => (
          <ReceiveCard key={currency} currency={currency} approved={approved} endorsements={endorsements} />
        ))}
      </div>
    </div>
  );
}
