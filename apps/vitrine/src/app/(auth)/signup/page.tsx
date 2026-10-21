'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { client, ApiError } from '@/lib/api/client';
import { validateWith } from '@/lib/forms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { full_name: '', email: '', password: '' } });

  const onSubmit = async (values: FormValues) => {
    const parsed = validateWith(schema, values);
    if (!parsed.success) {
      for (const [field, message] of Object.entries(parsed.errors)) {
        setError(field as keyof FormValues, { message });
      }
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await client.auth.signUp(parsed.data);
      toast.success('Account created');
      router.replace('/onboarding');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      setPending(false);
    }
  };

  return (
    <Card className="rounded-xl border-neutral-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Move money between fiat and crypto in minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {formError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input id="full_name" autoComplete="name" placeholder="Ada Lovelace" className="pl-9" {...register('full_name')} />
            </div>
            {errors.full_name ? <p className="text-xs text-red-600">{errors.full_name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="pl-9" {...register('email')} />
            </div>
            {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="pl-9 pr-9"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create account
          </Button>

          <p className="text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
