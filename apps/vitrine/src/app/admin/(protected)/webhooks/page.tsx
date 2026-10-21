import { WebhookLog } from '@/components/admin/webhook-log';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminWebhooksPage() {
  return <WebhookLog />;
}
