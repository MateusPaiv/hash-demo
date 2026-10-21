import { TransfersMonitor } from '@/components/admin/transfers-monitor';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminTransfersPage() {
  return <TransfersMonitor />;
}
