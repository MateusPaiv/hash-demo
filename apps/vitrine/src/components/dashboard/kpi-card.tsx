import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="rounded-xl border-neutral-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
          <div className="rounded-lg bg-neutral-100 p-1.5">
            <Icon className="size-4 text-neutral-600" />
          </div>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-neutral-900">
          {value}
        </p>
        {sub ? <p className="mt-1 text-xs text-neutral-500">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
