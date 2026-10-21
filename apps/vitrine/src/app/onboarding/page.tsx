'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { client, resumeSimulatedWebhooks } from '@/lib/api/client';
import { useSession } from '@/hooks/use-session';
import { useRealtimeQuery } from '@/hooks/use-realtime';
import { TopBar } from '@/components/shared/top-bar';
import { CustomerStatusBadge } from '@/components/shared/status-badge';
import { KycStatusCard } from '@/components/onboarding/kyc-status-card';
import { EndorsementList } from '@/components/onboarding/endorsement-list';
import { Separator } from '@/components/ui/separator';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  // Live customer status — re-runs on every (simulated) webhook-driven update.
  const { data: customer, loading } = useRealtimeQuery('customers', () => client.customer.me());

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login');
  }, [sessionLoading, user, router]);

  useEffect(() => {
    resumeSimulatedWebhooks();
  }, []);

  if (sessionLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
              Identity verification
            </h1>
            {customer ? <CustomerStatusBadge status={customer.status} /> : null}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome, {user.full_name.split(' ')[0]} — complete KYC once to unlock every payment rail.
          </p>
        </div>

        {loading || !customer ? (
          <div className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white py-20">
            <Loader2 className="size-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="space-y-8">
            <KycStatusCard customer={customer} />

            {customer.endorsements.length > 0 ? (
              <>
                <Separator />
                <section>
                  <h2 className="mb-1 text-lg font-semibold text-neutral-900">Your endorsements</h2>
                  <p className="mb-4 text-sm text-neutral-500">
                    Rails unlocked by your verification, updated in real time via webhooks.
                  </p>
                  <EndorsementList endorsements={customer.endorsements} />
                </section>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
