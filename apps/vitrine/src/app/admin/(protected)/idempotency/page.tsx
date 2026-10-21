import { IdempotencyAudit } from '@/components/admin/idempotency-audit';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminIdempotencyPage() {
  return <IdempotencyAudit />;
}
