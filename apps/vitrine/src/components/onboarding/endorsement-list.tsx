import {
  Building2,
  CheckCircle2,
  CircleDot,
  Clock,
  Coins,
  Globe2,
  Landmark,
  QrCode,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Endorsement, EndorsementName, EndorsementStatus } from '@hash/shared';
import { cn } from '@/lib/utils';

const ENDORSEMENT_META: Record<EndorsementName, { label: string; region: string; icon: LucideIcon }> = {
  base: { label: 'Base', region: 'United States · ACH/Wire', icon: Landmark },
  sepa: { label: 'SEPA', region: 'Eurozone · IBAN', icon: Globe2 },
  spei: { label: 'SPEI', region: 'Mexico · CLABE', icon: Building2 },
  pix: { label: 'Pix', region: 'Brazil · Pix', icon: QrCode },
  cop: { label: 'COP', region: 'Colombia', icon: Coins },
  faster_payments: { label: 'Faster Payments', region: 'United Kingdom', icon: Zap },
};

const STATUS_ICON: Record<EndorsementStatus, { icon: LucideIcon; className: string }> = {
  approved: { icon: CheckCircle2, className: 'text-emerald-600' },
  pending: { icon: Clock, className: 'text-amber-500' },
  rejected: { icon: XCircle, className: 'text-red-500' },
  incomplete: { icon: CircleDot, className: 'text-amber-500' },
};

export function EndorsementList({ endorsements }: { endorsements: Endorsement[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {endorsements.map((endorsement) => {
        const meta = ENDORSEMENT_META[endorsement.name];
        const status = STATUS_ICON[endorsement.status];
        const RailIcon = meta.icon;
        const StatusIcon = status.icon;
        return (
          <div
            key={endorsement.name}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
          >
            <div className="rounded-lg bg-neutral-100 p-2">
              <RailIcon className="size-4 text-neutral-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">{meta.label}</p>
              <p className="truncate text-xs text-neutral-500">{meta.region}</p>
            </div>
            <StatusIcon className={cn('size-5 shrink-0', status.className)} />
          </div>
        );
      })}
    </div>
  );
}
