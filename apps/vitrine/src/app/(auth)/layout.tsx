import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-4">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="rounded-xl bg-neutral-900 p-2">
          <ShieldCheck className="size-5 text-white" />
        </div>
        <span className="font-display text-xl font-semibold tracking-tight text-neutral-900">Hash</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-neutral-400">
        Demo environment — all data is mocked locally. No real money moves.
      </p>
    </div>
  );
}
