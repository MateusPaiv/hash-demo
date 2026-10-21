'use client';

/**
 * SIMULATED BRIDGE HOSTED KYC PAGE.
 *
 * In production, `client.kyc.createLink()` returns a Bridge-hosted URL and the
 * result arrives at the Cofre as a signed `kyc_link` / `customer` webhook.
 * For the demo, this page stands in for the hosted flow: completing it moves
 * the customer to `under_review` and schedules the (simulated) webhook that
 * delivers the final decision.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { client, ApiError } from '@/lib/api/client';
import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function KycSimulatorPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [pending, setPending] = useState<'approved' | 'rejected' | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  const complete = async (outcome: 'approved' | 'rejected') => {
    setPending(outcome);
    try {
      await client.kyc.completeHostedSession(outcome);
      setDone(outcome);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace('/login');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-md rounded-xl border-neutral-200 shadow-sm">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <div className="rounded-xl bg-blue-600 p-2.5">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              Simulation
            </Badge>
          </div>
          <CardTitle className="text-xl">Bridge Hosted KYC</CardTitle>
          <CardDescription>
            This page simulates the Bridge-hosted identity verification flow for the Hash demo. No
            real documents are collected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-neutral-400" />
            </div>
          ) : !user ? (
            <p className="text-sm text-neutral-500">Sign in to Hash before completing verification.</p>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              {done === 'approved' ? (
                <CheckCircle2 className="size-10 text-emerald-500" />
              ) : (
                <XCircle className="size-10 text-red-500" />
              )}
              <p className="text-sm font-medium text-neutral-900">
                Verification submitted{done === 'rejected' ? ' (will be rejected)' : ''}
              </p>
              <p className="text-xs text-neutral-500">
                Bridge is reviewing the submission. You can close this tab — the Hash onboarding page
                updates in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => complete('approved')}
                disabled={pending !== null}
              >
                {pending === 'approved' ? <Loader2 className="size-4 animate-spin" /> : null}
                Complete verification
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => complete('rejected')}
                disabled={pending !== null}
              >
                {pending === 'rejected' ? <Loader2 className="size-4 animate-spin" /> : null}
                Simulate rejection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-neutral-400">api.bridge.xyz/v0 · hosted flow simulator</p>
    </div>
  );
}
