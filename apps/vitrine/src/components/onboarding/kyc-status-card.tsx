'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '@hash/shared';
import { client, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function KycStatusCard({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const startVerification = async () => {
    setPending(true);
    try {
      const { url } = await client.kyc.createLink();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not start verification');
    } finally {
      setPending(false);
    }
  };

  switch (customer.status) {
    case 'not_started':
    case 'incomplete':
      return (
        <Card className="rounded-xl border-neutral-200 shadow-sm">
          <CardHeader>
            <div className="mb-2 w-fit rounded-xl bg-neutral-900 p-2.5">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <CardTitle className="text-xl">Verify your identity</CardTitle>
            <CardDescription>
              One quick verification unlocks every rail — ACH, SEPA, SPEI and Pix. It takes about
              two minutes on our partner Bridge&apos;s hosted page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={startVerification} disabled={pending} className="w-full sm:w-auto">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Start verification
            </Button>
            <p className="mt-3 text-xs text-neutral-400">
              Demo: opens a simulated Bridge hosted KYC page in a new tab.
            </p>
          </CardContent>
        </Card>
      );

    case 'under_review':
      return (
        <Card className="rounded-xl border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader>
            <div className="mb-2 w-fit rounded-xl bg-amber-100 p-2.5">
              <Clock className="size-5 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Verification under review</CardTitle>
            <CardDescription>
              Your documents were submitted and Bridge is reviewing them. This page updates in real
              time — no need to refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <Loader2 className="size-4 animate-spin" />
              Waiting for webhook confirmation…
            </div>
          </CardContent>
        </Card>
      );

    case 'approved':
      return (
        <Card className="rounded-xl border-emerald-200 bg-emerald-50/50 shadow-sm">
          <CardHeader>
            <div className="mb-2 w-fit rounded-xl bg-emerald-100 p-2.5">
              <BadgeCheck className="size-5 text-emerald-600" />
            </div>
            <CardTitle className="text-xl">You&apos;re verified</CardTitle>
            <CardDescription>
              Your account is approved and the following payment rails are now active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full sm:w-auto">
              Continue to dashboard
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      );

    case 'rejected':
      return (
        <Card className="rounded-xl border-red-200 bg-red-50/50 shadow-sm">
          <CardHeader>
            <div className="mb-2 w-fit rounded-xl bg-red-100 p-2.5">
              <XCircle className="size-5 text-red-600" />
            </div>
            <CardTitle className="text-xl">Verification failed</CardTitle>
            <CardDescription>
              Bridge couldn&apos;t verify your identity this time. You can restart the process with
              updated documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={startVerification} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Try again
            </Button>
          </CardContent>
        </Card>
      );
  }
}
