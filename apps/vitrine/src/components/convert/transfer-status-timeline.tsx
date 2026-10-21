import { CheckCircle2, Clock, Send, Wallet, type LucideIcon } from 'lucide-react';
import type { TransferState } from '@hash/shared';
import { HAPPY_PATH_STATES } from '@hash/shared';
import { TransferStateBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';

const STEP_META: Array<{ state: (typeof HAPPY_PATH_STATES)[number]; label: string; icon: LucideIcon }> = [
  { state: 'awaiting_funds', label: 'Aguardando recursos', icon: Clock },
  { state: 'funds_received', label: 'Recursos recebidos', icon: Wallet },
  { state: 'payment_submitted', label: 'Pagamento enviado', icon: Send },
  { state: 'payment_processed', label: 'Concluído', icon: CheckCircle2 },
];

export function TransferStatusTimeline({ state }: { state: TransferState }) {
  const currentIndex = (HAPPY_PATH_STATES as readonly TransferState[]).indexOf(state);

  // Exception path (canceled, refunded, …) — a badge communicates it best.
  if (currentIndex === -1) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-500">Esta transferência saiu do fluxo padrão:</span>
        <TransferStateBadge state={state} />
      </div>
    );
  }

  return (
    <ol className="flex items-center">
      {STEP_META.map((step, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const Icon = step.icon;
        return (
          <li key={step.state} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                aria-label={step.label}
                title={step.label}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border transition-colors',
                  reached
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-400',
                  isCurrent && state !== 'payment_processed' && 'animate-pulse',
                )}
              >
                <Icon className="size-4" />
              </div>
              {/* Icon-only on phones; the state badge above carries the PT label */}
              <span
                className={cn(
                  'hidden whitespace-nowrap text-[11px] font-medium sm:block',
                  reached ? 'text-neutral-900' : 'text-neutral-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEP_META.length - 1 ? (
              <div
                className={cn(
                  'mx-2 h-px flex-1',
                  index < currentIndex ? 'bg-neutral-900' : 'bg-neutral-200',
                  'mb-0 sm:mb-5',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
