import { EmailOutbox } from '@/components/admin/email-outbox';

/** cacheComponents: client-rendered ops views — instant validation opt-out. */
export const instant = false;

export default function AdminEmailsPage() {
  return <EmailOutbox />;
}
