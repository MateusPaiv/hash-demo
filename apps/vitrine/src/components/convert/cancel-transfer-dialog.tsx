'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { client, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

/**
 * Cancel is only rendered while the transfer is `awaiting_funds` — the only
 * state Bridge allows cancellation from (DELETE /v0/transfers/{id}).
 */
export function CancelTransferButton({ transferId }: { transferId: string }) {
  const [open, setOpen] = useState(false);

  const cancel = async () => {
    try {
      await client.transfers.cancel(transferId);
      toast.success('Transfer canceled', { id: transferId });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not cancel transfer');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <XCircle className="size-4" />
        Cancel transfer
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        icon={XCircle}
        title="Cancel this transfer?"
        description="Cancellation is only possible while the transfer is awaiting funds. This cannot be undone."
        confirmLabel="Cancel transfer"
        onConfirm={cancel}
      />
    </>
  );
}
