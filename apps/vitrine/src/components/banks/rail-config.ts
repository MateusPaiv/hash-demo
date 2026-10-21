import { z } from 'zod';
import type { ExternalAccountRail, FiatCurrency } from '@hash/shared';

const holder = z.string().trim().min(2, 'Enter the account holder name');
const bank = z.string().trim().min(2, 'Enter the bank name');
const routing = z.string().regex(/^\d{9}$/, 'Routing number must be 9 digits');
const accountNumber = z.string().regex(/^\d{4,17}$/, 'Account number must be 4–17 digits');

const achSchema = z.object({
  rail: z.literal('ach'),
  account_holder_name: holder,
  bank_name: bank,
  routing_number: routing,
  account_number: accountNumber,
  account_subtype: z.enum(['checking', 'savings']),
});

const wireSchema = z.object({
  rail: z.literal('wire'),
  account_holder_name: holder,
  bank_name: bank,
  routing_number: routing,
  account_number: accountNumber,
});

const ibanSchema = z.object({
  rail: z.literal('iban'),
  account_holder_name: holder,
  bank_name: bank,
  // IBANs are commonly written in space-separated groups; normalize then validate.
  iban: z
    .string()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .refine((value) => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value), 'Enter a valid IBAN'),
  bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i, 'Enter a valid BIC/SWIFT'),
});

const clabeSchema = z.object({
  rail: z.literal('clabe'),
  account_holder_name: holder,
  bank_name: bank,
  clabe: z.string().regex(/^\d{18}$/, 'CLABE must be exactly 18 digits'),
});

const fasterPaymentsSchema = z.object({
  rail: z.literal('faster_payments'),
  account_holder_name: holder,
  bank_name: bank,
  sort_code: z.string().regex(/^\d{6}$/, 'Sort code must be 6 digits'),
  account_number: z.string().regex(/^\d{6,8}$/, 'UK account numbers use 6–8 digits'),
});

const bankTransferCoSchema = z.object({
  rail: z.literal('bank_transfer_co'),
  account_holder_name: holder,
  bank_name: bank,
  account_number: z.string().regex(/^[0-9]{6,20}$/, 'Account number must be 6–20 digits'),
  account_subtype: z.enum(['checking', 'savings']),
});

const PIX_KEY_VALIDATORS: Record<string, { test: (key: string) => boolean; message: string }> = {
  cpf: { test: (k) => /^\d{11}$/.test(k), message: 'CPF must be 11 digits' },
  cnpj: { test: (k) => /^\d{14}$/.test(k), message: 'CNPJ must be 14 digits' },
  email: { test: (k) => z.string().email().safeParse(k).success, message: 'Enter a valid email' },
  phone: { test: (k) => /^\+?\d{10,15}$/.test(k), message: 'Enter a valid phone (digits, optional +)' },
  evp: {
    test: (k) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k),
    message: 'EVP keys are UUIDs',
  },
};

const pixSchema = z
  .object({
    rail: z.literal('pix'),
    account_holder_name: holder,
    bank_name: z.string().trim().optional(),
    pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'evp']),
    pix_key: z.string().trim().min(1, 'Enter the Pix key'),
  })
  .superRefine((values, ctx) => {
    const validator = PIX_KEY_VALIDATORS[values.pix_key_type];
    if (validator && !validator.test(values.pix_key)) {
      ctx.addIssue({ code: 'custom', path: ['pix_key'], message: validator.message });
    }
  });

export const bankAccountSchema = z.discriminatedUnion('rail', [
  achSchema,
  wireSchema,
  ibanSchema,
  fasterPaymentsSchema,
  clabeSchema,
  pixSchema,
  bankTransferCoSchema,
]);

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

export const RAIL_LABEL: Record<ExternalAccountRail, string> = {
  ach: 'ACH',
  wire: 'Wire',
  iban: 'IBAN · SEPA',
  faster_payments: 'Faster Payments',
  clabe: 'CLABE · SPEI',
  pix: 'Pix',
  bank_transfer_co: 'Bank transfer CO',
};

export function railForCurrency(currency: FiatCurrency, usdRail: 'ach' | 'wire'): ExternalAccountRail {
  switch (currency) {
    case 'usd':
      return usdRail;
    case 'eur':
      return 'iban';
    case 'gbp':
      return 'faster_payments';
    case 'mxn':
      return 'clabe';
    case 'brl':
      return 'pix';
    case 'cop':
      return 'bank_transfer_co';
  }
}
