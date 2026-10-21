import { KycQueue } from '@/components/admin/kyc-queue';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminKycPage() {
  return <KycQueue />;
}
