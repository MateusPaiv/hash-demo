'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Coins,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Currency, ExternalAccount, Transfer } from '@hash/shared';
import { client, ApiError } from '@/lib/api/client';
import { pendingToasts } from '@/lib/pending-toasts';
import { CURRENCY_LABEL, CURRENCY_NAME, FIAT_CURRENCIES } from '@/lib/constants';
import { formatAmount } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ALL_CURRENCIES: Currency[] = [...FIAT_CURRENCIES, 'usdc'];
const WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;
/** Initial label before live fee loads from GET /developer/fees. */
const DEFAULT_FEE_PERCENT = '1.0';
const DEFAULT_WALLET = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

function CurrencySelect({
  value,
  onChange,
  id,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
  id: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger id={id} className="w-[132px] bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_CURRENCIES.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {CURRENCY_LABEL[currency]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SwapWidget({
  accounts,
  kycApproved,
  pendingTransferId,
  onPendingChange,
}: {
  accounts: ExternalAccount[];
  kycApproved: boolean;
  pendingTransferId: string | null;
  onPendingChange: (transfer: Transfer | null) => void;
}) {
  const [sendCurrency, setSendCurrency] = useState<Currency>('usd');
  const [receiveCurrency, setReceiveCurrency] = useState<Currency>('usdc');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(DEFAULT_WALLET);
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastFiatRef = useRef<Currency>('usd');
  const inFlightRef = useRef(false);
  /** One UUID per intent. A double-click reuses it so the store dedupes. */
  const idempotencyKeyRef = useRef<string | null>(null);

  const cryptoToFiat = sendCurrency === 'usdc';

  // Live rate for the active pair, refreshed on an interval.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRateLoading(true);
      try {
        const quote = await client.rates.get(sendCurrency, receiveCurrency);
        if (!cancelled) setRate(Number(quote.mid_rate));
      } catch {
        if (!cancelled) setRate(null);
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sendCurrency, receiveCurrency]);

  // Platform take-rate comes from GET /developer/fees (admin-editable), not a constant.
  const [feeLabel, setFeeLabel] = useState(DEFAULT_FEE_PERCENT);
  useEffect(() => {
    let cancelled = false;
    client.developerFees.get().then((percent) => {
      if (!cancelled) setFeeLabel(percent);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Destination accounts matching the receiving fiat currency (active only).
  const eligibleAccounts = useMemo(
    () => accounts.filter((a) => a.currency === receiveCurrency && a.status === 'active'),
    [accounts, receiveCurrency],
  );
  const destinationAccountId = eligibleAccounts.some((account) => account.id === pickedAccountId)
    ? pickedAccountId
    : (eligibleAccounts[0]?.id ?? null);

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [sendCurrency, receiveCurrency, amount, walletAddress, destinationAccountId]);

  const amountNumber = Number(amount) || 0;
  const feePercent = Number(feeLabel) / 100;
  const feeAmount = amountNumber * feePercent;
  const receiveAmount = rate != null && amountNumber > 0 ? (amountNumber - feeAmount) * rate : 0;

  const walletValid = WALLET_PATTERN.test(walletAddress);
  const destinationReady = cryptoToFiat ? destinationAccountId != null : walletValid;
  const canSubmit =
    kycApproved &&
    amountNumber > 0 &&
    rate != null &&
    destinationReady &&
    !submitting &&
    pendingTransferId == null;

  const handleSendChange = (next: Currency) => {
    setSendCurrency(next);
    if (next === 'usdc') {
      setReceiveCurrency(lastFiatRef.current);
    } else {
      lastFiatRef.current = next;
      setReceiveCurrency('usdc');
    }
  };

  const handleReceiveChange = (next: Currency) => {
    setReceiveCurrency(next);
    if (next === 'usdc') {
      if (sendCurrency === 'usdc') setSendCurrency(lastFiatRef.current);
    } else {
      lastFiatRef.current = next;
      setSendCurrency('usdc');
    }
  };

  const flip = () => {
    const previousSend = sendCurrency;
    setSendCurrency(receiveCurrency);
    setReceiveCurrency(previousSend);
    if (receiveCurrency !== 'usdc') lastFiatRef.current = receiveCurrency;
  };

  const confirm = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const { transfer } = await client.transfers.create({
        amount: amountNumber.toFixed(2),
        source_currency: sendCurrency,
        destination_currency: receiveCurrency,
        destination_external_account_id: cryptoToFiat ? destinationAccountId! : undefined,
        destination_wallet_address: cryptoToFiat ? undefined : walletAddress,
        developer_fee_percent: feeLabel,
        idempotency_key: idempotencyKey,
      });
      idempotencyKeyRef.current = null;
      // Persistent toast — resolved only when the (simulated) webhook lands.
      // Registered so the convert page can claim it even after navigating away.
      pendingToasts.register(transfer.id);
      toast.loading('Transaction processing. Awaiting Bridge API webhook confirmation…', {
        id: transfer.id,
        duration: Infinity,
      });
      onPendingChange(transfer);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create transfer');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const busy = submitting || pendingTransferId != null;

  return (
    <Card className="rounded-xl border-neutral-200 shadow-sm">
      <CardContent className="p-4 sm:p-6">
        {/* You send */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label htmlFor="send-amount" className="text-xs uppercase tracking-wide text-neutral-500">
              You send
            </Label>
            <CurrencySelect id="send-currency" value={sendCurrency} onChange={handleSendChange} />
          </div>
          <Input
            id="send-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="h-12 border-0 bg-transparent p-0 font-display text-2xl font-semibold tabular-nums shadow-none focus-visible:ring-0 sm:text-3xl"
            disabled={busy}
          />
          <p className="mt-1 text-xs text-neutral-400">{CURRENCY_NAME[sendCurrency]}</p>
        </div>

        {/* Flip */}
        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={flip}
            aria-label="Swap direction"
            disabled={busy}
            className="rounded-full border border-neutral-200 bg-white p-2.5 shadow-sm transition-transform hover:rotate-180 hover:shadow disabled:opacity-50"
          >
            <ArrowDownUp className="size-4 text-neutral-700" />
          </button>
        </div>

        {/* You receive */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs uppercase tracking-wide text-neutral-500">You receive</Label>
            <CurrencySelect id="receive-currency" value={receiveCurrency} onChange={handleReceiveChange} />
          </div>
          <div className="flex h-12 items-center font-display text-2xl font-semibold tabular-nums text-neutral-900 sm:text-3xl">
            {receiveAmount > 0 ? (
              receiveAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })
            ) : (
              <span className="text-neutral-300">0.00</span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-400">{CURRENCY_NAME[receiveCurrency]}</p>
        </div>

        {/* Destination */}
        <div className="mt-4">
          {cryptoToFiat ? (
            eligibleAccounts.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Landmark className="size-3.5 text-neutral-400" />
                  Payout account
                </Label>
                <Select
                  value={destinationAccountId ?? undefined}
                  onValueChange={(v) => setPickedAccountId(v)}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Choose a bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bank_name} · {CURRENCY_LABEL[account.currency]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  No {CURRENCY_LABEL[receiveCurrency]} bank account linked.{' '}
                  <Link href="/dashboard/banks" className="font-medium underline underline-offset-4">
                    Add one first
                  </Link>{' '}
                  to receive this payout.
                </span>
              </div>
            )
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="wallet" className="flex items-center gap-1.5">
                <Wallet className="size-3.5 text-neutral-400" />
                Destination wallet · USDC on Base
              </Label>
              <Input
                id="wallet"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value.trim())}
                className="bg-white font-mono text-xs"
                aria-invalid={!walletValid || undefined}
                disabled={busy}
              />
              {!walletValid ? (
                <p className="text-xs text-red-600">Enter a valid EVM address (0x + 40 hex chars)</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Quote breakdown */}
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-neutral-500">
            <span className="flex items-center gap-1.5">
              <RefreshCw className={rateLoading ? 'size-3.5 animate-spin' : 'size-3.5'} />
              Rate
            </span>
            <span className="font-mono text-xs">
              {rate != null ? `1 ${CURRENCY_LABEL[sendCurrency]} ≈ ${rate.toFixed(4)} ${CURRENCY_LABEL[receiveCurrency]}` : '—'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-neutral-500">
            <span className="flex items-center gap-1.5">
              Developer fee ({feeLabel}%)
              <Tooltip>
                <TooltipTrigger render={<Info className="size-3.5 text-neutral-400" />} />
                <TooltipContent>Hash&apos;s take-rate, passed to Bridge as developer_fee_percent.</TooltipContent>
              </Tooltip>
            </span>
            <span className="font-mono text-xs">
              −{formatAmount(feeAmount.toFixed(2), sendCurrency)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-medium text-neutral-900">
            <span>Estimated receive</span>
            <span>{receiveAmount > 0 ? formatAmount(receiveAmount.toFixed(2), receiveCurrency) : '—'}</span>
          </div>
        </div>

        <Button className="mt-6 w-full" size="lg" onClick={confirm} disabled={!canSubmit}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Awaiting webhook confirmation…
            </>
          ) : (
            <>
              Confirm transfer
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
        {!kycApproved ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-amber-600">
            <Coins className="size-3.5" />
            Identity verification required before converting.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
