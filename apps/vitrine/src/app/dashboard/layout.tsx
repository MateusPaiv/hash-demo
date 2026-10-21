'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight, Landmark, LayoutDashboard, Loader2, LogOut, ShieldCheck, Wallet, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { client, resumeSimulatedWebhooks } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/convert', label: 'Convert', icon: ArrowLeftRight, exact: false },
  { href: '/dashboard/receive', label: 'Receive', icon: Wallet, exact: false },
  { href: '/dashboard/banks', label: 'Banks', icon: Landmark, exact: false },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    resumeSimulatedWebhooks();
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const signOut = async () => {
    await client.auth.signOut();
    toast.success('Signed out');
    router.replace('/login');
  };

  const nav = (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <div className="rounded-xl bg-neutral-900 p-2">
        <ShieldCheck className="size-5 text-white" />
      </div>
      <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">Hash</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-neutral-200 bg-white p-4 md:flex">
        <div className="px-1 py-2">{brand}</div>
        <nav className="mt-6 flex flex-col gap-1">{nav}</nav>
        <div className="mt-auto space-y-1 border-t border-neutral-200 pt-4">
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium text-neutral-900">{user.full_name}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
          <Link
            href="/admin"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Wrench className="size-4" />
            Backoffice
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        {brand}
        <div className="flex max-w-[55%] items-center gap-1 overflow-x-auto">
          {nav}
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="shrink-0 rounded-xl p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      <main className="px-4 py-8 md:ml-60 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
