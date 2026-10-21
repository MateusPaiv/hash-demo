import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { CustomerStatus } from '@hash/shared';
import { buttonVariants } from '@/components/ui/button';

/**
 * Shown anywhere the user's KYC status blocks money movement. Same copy and
 * treatment across screens so the platform speaks with one voice.
 */
export function KycBanner({ status }: { status: CustomerStatus }) {
  const message =
    status === 'under_review'
      ? 'Your identity verification is under review — converting unlocks once approved.'
      : 'Complete identity verification to start converting.';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-sm text-amber-800">{message}</p>
      <Link href="/onboarding" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Go to verification
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
