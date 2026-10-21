import { formatAmount } from '@/lib/format';
import type { DayVolume } from '@/lib/metrics';
import { cn } from '@/lib/utils';

/** Dependency-free 14-day volume bars — divs only, no chart library. */
export function VolumeChart({ data }: { data: DayVolume[] }) {
  const max = Math.max(...data.map((d) => d.usd), 0.01);

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((day, index) => {
          const height = day.usd === 0 ? 4 : Math.max((day.usd / max) * 96, 8);
          return (
            <div
              key={index}
              title={`${day.label} — ${formatAmount(day.usd.toFixed(2), 'usd')}`}
              className="group flex h-full flex-1 flex-col justify-end"
            >
              <div
                style={{ height: `${height}%` }}
                className={cn(
                  'w-full rounded-md transition-colors',
                  day.usd === 0
                    ? 'bg-neutral-200'
                    : 'bg-neutral-900 group-hover:bg-neutral-600',
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
