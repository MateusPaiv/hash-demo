'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { AlertCircle, KeyRound, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { adminApi, ApiError } from '@/lib/api/admin';
import { validateWith } from '@/lib/forms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_EMAIL = 'admin@hash.demo';
const DEMO_PASSWORD = 'hash-admin-2026';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { email: DEMO_EMAIL, password: '' } });

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
      await adminApi.auth.login(parsed.data);
      router.replace('/admin');
      // Dev escape hatch: if the client router stalls on stale HMR chunks,
      // force a hard navigation so the console always recovers.
      window.setTimeout(() => {
        if (window.location.pathname !== '/admin') {
          window.location.assign('/admin');
        }
      }, 2_500);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Try again.');
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-sm rounded-xl border-neutral-200 shadow-sm">
        <CardHeader>
          <div className="mb-2 w-fit rounded-xl bg-neutral-900 p-2.5">
            <KeyRound className="size-5 text-white" />
          </div>
          <CardTitle className="text-xl">Backoffice sign in</CardTitle>
          <CardDescription>
            Operations console — separate credentials from the customer app.
          </CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <Input id="email" type="email" className="pl-9" {...register('email')} />
              </div>
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <Input id="password" type="password" className="pl-9" {...register('password')} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="text-xs font-medium text-neutral-700">Demo credentials</p>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">
              {DEMO_EMAIL} · {DEMO_PASSWORD}
            </p>
          </div>
        </CardContent>
      </Card>
      <p className="mt-8 text-xs text-neutral-400">Hash · operations console (mocked)</p>
    </div>
  );
}
