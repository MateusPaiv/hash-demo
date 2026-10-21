'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { client } from '@/lib/api/client';

/** Minimal chrome for pages outside the dashboard (e.g. onboarding). */
export function TopBar() {
  const router = useRouter();

  const signOut = async () => {
    await client.auth.signOut();
    toast.success('Signed out');
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="rounded-xl bg-neutral-900 p-2">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">Hash</span>
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </header>
  );
}
