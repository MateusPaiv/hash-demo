import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Hourglass,
  RotateCcw,
  RefreshCw,
  Send,
  Undo2,
  Wallet,
  XCircle,
  XOctagon,
  type LucideIcon,
} from 'lucide-react';
import type { CustomerStatus, TransferState } from '@hash/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

const AMBER = 'border-amber-200 bg-amber-50 text-amber-700';
const BLUE = 'border-blue-200 bg-blue-50 text-blue-700';
const GREEN = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const RED = 'border-red-200 bg-red-50 text-red-700';
const NEUTRAL = 'border-neutral-200 bg-neutral-100 text-neutral-600';

/**
 * Per the product scope, state labels are presented in Portuguese. The
 * canonical enum values remain English (Bridge schema) — only the display
 * labels localize.
 */
const TRANSFER_CONFIG: Record<TransferState, StatusConfig> = {
  awaiting_funds: { label: 'Aguardando recursos', icon: Clock, className: AMBER },
  in_review: { label: 'Em revisão', icon: Hourglass, className: AMBER },
  funds_received: { label: 'Recursos recebidos', icon: Wallet, className: BLUE },
  payment_submitted: { label: 'Pagamento enviado', icon: Send, className: BLUE },
  payment_processed: { label: 'Concluído', icon: CheckCircle2, className: GREEN },
  canceled: { label: 'Cancelado', icon: Ban, className: NEUTRAL },
  undeliverable: { label: 'Não entregável', icon: AlertTriangle, className: RED },
  returned: { label: 'Retornado', icon: Undo2, className: AMBER },
  refund_in_flight: { label: 'Reembolso em trânsito', icon: RefreshCw, className: BLUE },
  refund_failed: { label: 'Falha no reembolso', icon: XOctagon, className: RED },
  refunded: { label: 'Reembolsado', icon: RotateCcw, className: NEUTRAL },
};

const CUSTOMER_CONFIG: Record<CustomerStatus, StatusConfig> = {
  not_started: { label: 'Não iniciado', icon: Circle, className: NEUTRAL },
  incomplete: { label: 'Incompleto', icon: CircleDot, className: AMBER },
  under_review: { label: 'Em revisão', icon: Clock, className: AMBER },
  approved: { label: 'Aprovado', icon: CheckCircle2, className: GREEN },
  rejected: { label: 'Rejeitado', icon: XCircle, className: RED },
};

export function TransferStateBadge({ state, className }: { state: TransferState; className?: string }) {
  const config = TRANSFER_CONFIG[state];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', config.className, className)}>
      <Icon className="size-3.5" />
      {config.label}
    </Badge>
  );
}

export function CustomerStatusBadge({ status, className }: { status: CustomerStatus; className?: string }) {
  const config = CUSTOMER_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', config.className, className)}>
      <Icon className="size-3.5" />
      {config.label}
    </Badge>
  );
}
