import { OpsOverview } from '@/components/admin/ops-overview';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminPage() {
  return <OpsOverview />;
}
