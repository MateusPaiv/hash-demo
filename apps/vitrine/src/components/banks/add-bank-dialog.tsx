'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Building2,
  Globe2,
  Landmark,
  Loader2,
  Plus,
  QrCode,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExternalAccountRail, FiatCurrency, PixKeyType } from '@hash/shared';
import { client, ApiError } from '@/lib/api/client';
import { validateWith } from '@/lib/forms';
import { CURRENCY_LABEL, CURRENCY_NAME, FIAT_CURRENCIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { bankAccountSchema, railForCurrency } from './rail-config';

interface BankFormValues {
  rail: ExternalAccountRail;
  account_holder_name: string;
  bank_name: string;
  routing_number: string;
  account_number: string;
  account_subtype: 'checking' | 'savings';
  sort_code: string;
  iban: string;
  bic: string;
  clabe: string;
  pix_key_type: PixKeyType;
  pix_key: string;
}

const DEFAULT_VALUES: BankFormValues = {
  rail: 'ach',
  account_holder_name: '',
  bank_name: '',
  routing_number: '',
  account_number: '',
  account_subtype: 'checking',
  sort_code: '',
  iban: '',
  bic: '',
  clabe: '',
  pix_key_type: 'cpf',
  pix_key: '',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

function IconInput({
  icon: Icon,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon; error?: boolean }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
      <Input className="pl-9" aria-invalid={error || undefined} {...props} />
    </div>
  );
}

export function AddBankDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currency, setCurrency] = useState<FiatCurrency>('usd');
  const [usdRail, setUsdRail] = useState<'ach' | 'wire'>('ach');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('cpf');
  const [accountSubtype, setAccountSubtype] = useState<'checking' | 'savings'>('checking');
  const [pending, setPending] = useState(false);
  const rail = railForCurrency(currency, usdRail);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<BankFormValues>({ defaultValues: DEFAULT_VALUES });

  const changeCurrency = (next: FiatCurrency) => {
    setCurrency(next);
    setValue('rail', railForCurrency(next, usdRail));
    clearErrors();
  };

  const changeUsdRail = (next: 'ach' | 'wire') => {
    setUsdRail(next);
    setValue('rail', next);
    clearErrors();
  };

  const close = (next: boolean) => {
    if (!next) {
      reset(DEFAULT_VALUES);
      setCurrency('usd');
      setUsdRail('ach');
      setPixKeyType('cpf');
      setAccountSubtype('checking');
    }
    onOpenChange(next);
  };

  const onSubmit = async (values: BankFormValues) => {
    const parsed = validateWith(bankAccountSchema, {
      ...values,
      rail,
      iban: values.iban.replace(/\s/g, ''),
    });
    if (!parsed.success) {
      for (const [field, message] of Object.entries(parsed.errors)) {
        setError(field as keyof BankFormValues, { message });
      }
      return;
    }
    setPending(true);
    try {
      await client.externalAccounts.create(parsed.data);
      toast.success('Bank account added');
      close(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not add bank account');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 w-fit rounded-xl bg-neutral-100 p-2.5">
            <Landmark className="size-5 text-neutral-700" />
          </div>
          <DialogTitle>Add bank account</DialogTitle>
          <DialogDescription>
            Link an external account to receive fiat payouts. Fields adapt to the rail you choose.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Currency + rail selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => changeCurrency(v as FiatCurrency)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIAT_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_LABEL[c]} — {CURRENCY_NAME[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currency === 'usd' ? (
              <div className="space-y-1.5">
                <Label>Rail</Label>
                <Select value={usdRail} onValueChange={(v) => changeUsdRail(v as 'ach' | 'wire')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH — standard</SelectItem>
                    <SelectItem value="wire">Wire — same day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <Separator />

          {/* Common fields */}
          <div className="space-y-1.5">
            <Label htmlFor="account_holder_name">Account holder name</Label>
            <IconInput icon={User} id="account_holder_name" placeholder="Ada Lovelace" error={!!errors.account_holder_name} {...register('account_holder_name')} />
            <FieldError message={errors.account_holder_name?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank_name">
              Bank name{rail === 'pix' ? ' (optional)' : ''}
            </Label>
            <IconInput icon={Landmark} id="bank_name" placeholder="Lead Bank" error={!!errors.bank_name} {...register('bank_name')} />
            <FieldError message={errors.bank_name?.message} />
          </div>

          {/* Rail-specific fields */}
          {rail === 'ach' || rail === 'wire' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="routing_number">Routing number</Label>
                  <IconInput icon={Building2} id="routing_number" inputMode="numeric" placeholder="9 digits" error={!!errors.routing_number} {...register('routing_number')} />
                  <FieldError message={errors.routing_number?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account_number">Account number</Label>
                  <IconInput icon={Wallet} id="account_number" inputMode="numeric" placeholder="4–17 digits" error={!!errors.account_number} {...register('account_number')} />
                  <FieldError message={errors.account_number?.message} />
                </div>
              </div>
              {rail === 'ach' ? (
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <Select
                    value={accountSubtype}
                    onValueChange={(v) => {
                      const next = v as 'checking' | 'savings';
                      setAccountSubtype(next);
                      setValue('account_subtype', next);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          ) : null}

          {rail === 'faster_payments' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sort_code">Sort code</Label>
                <IconInput icon={Building2} id="sort_code" inputMode="numeric" placeholder="6 digits" error={!!errors.sort_code} {...register('sort_code')} />
                <FieldError message={errors.sort_code?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account_number">Account number</Label>
                <IconInput icon={Wallet} id="account_number" inputMode="numeric" placeholder="6–8 digits" error={!!errors.account_number} {...register('account_number')} />
                <FieldError message={errors.account_number?.message} />
              </div>
            </div>
          ) : null}

          {rail === 'bank_transfer_co' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="account_number">Account number</Label>
                <IconInput icon={Wallet} id="account_number" inputMode="numeric" placeholder="6–20 digits" error={!!errors.account_number} {...register('account_number')} />
                <FieldError message={errors.account_number?.message} />
              </div>
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <Select value={accountSubtype} onValueChange={(v) => setValue('account_subtype', v as 'checking' | 'savings')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {rail === 'iban' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="iban">IBAN</Label>
                <IconInput icon={Globe2} id="iban" placeholder="DE89 3704 0044 0532 0130 00" error={!!errors.iban} {...register('iban')} />
                <FieldError message={errors.iban?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bic">BIC / SWIFT</Label>
                <IconInput icon={Building2} id="bic" placeholder="COBADEFFXXX" error={!!errors.bic} {...register('bic')} />
                <FieldError message={errors.bic?.message} />
              </div>
            </div>
          ) : null}

          {rail === 'clabe' ? (
            <div className="space-y-1.5">
              <Label htmlFor="clabe">CLABE</Label>
              <IconInput icon={Building2} id="clabe" inputMode="numeric" placeholder="18 digits" error={!!errors.clabe} {...register('clabe')} />
              <FieldError message={errors.clabe?.message} />
            </div>
          ) : null}

          {rail === 'pix' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pix key type</Label>
                <Select
                  value={pixKeyType}
                  onValueChange={(v) => {
                    const next = v as PixKeyType;
                    setPixKeyType(next);
                    setValue('pix_key_type', next);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="evp">Random key (EVP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix_key">Pix key</Label>
                <IconInput icon={QrCode} id="pix_key" error={!!errors.pix_key} {...register('pix_key')} />
                <FieldError message={errors.pix_key?.message} />
              </div>
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add bank account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
