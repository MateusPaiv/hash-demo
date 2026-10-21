'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  CircleDollarSign,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  UserCheck,
  Webhook,
} from 'lucide-react';
import { useAdminSession } from '@/hooks/use-admin-session';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
  { href: '/admin', label: 'Operations', icon: LayoutDashboard, exact: true },
  { href: '/admin/kyc', label: 'KYC review', icon: UserCheck, exact: false },
  { href: '/admin/transfers', label: 'Transfers', icon: ArrowLeftRight, exact: false },
  { href: '/admin/webhooks', label: 'Webhook log', icon: Webhook, exact: false },
  { href: '/admin/idempotency', label: 'Idempotency', icon: KeyRound, exact: false },
  { href: '/admin/emails', label: 'Emails', icon: Mail, exact: false },
  { href: '/admin/fees', label: 'Fees', icon: CircleDollarSign, exact: false },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authed, loading } = useAdminSession();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || !authed) setStalled(true); // likely stale chunks — offer a way out
    }, 6_000);
    return () => clearTimeout(timer);
  }, [loading, authed]);

  useEffect(() => {
    if (!loading && !authed) router.replace('/admin/login');
  }, [loading, authed, router]);

  if (loading || !authed) {
    return stalled ? (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4 text-center">
        <p className="text-sm text-neutral-700">
          The backoffice session did not load. Your tab is likely holding stale
          code from a server restart.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button onClick={() => window.location.assign('/admin/login')}>Back to sign-in</Button>
        </div>
      </div>
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const signOut = async () => {
    await adminApi.auth.logout();
    toast.success('Signed out of the backoffice');
    router.replace('/admin/login');
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-neutral-200 bg-white p-4 md:flex">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <div className="rounded-xl bg-neutral-900 p-2">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-neutral-900">
              Hash Ops
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
              Backoffice
            </p>
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {ADMIN_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
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
        </nav>
        <div className="mt-auto space-y-1 border-t border-neutral-200 pt-4">
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ShieldCheck className="size-4" />
            Client app
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

      {/* Mobile chrome */}
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold">Hash Ops</span>
          <button onClick={signOut} aria-label="Sign out" className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100">
            <LogOut className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {ADMIN_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium',
                  active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100',
                )}
              >                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="px-4 py-8 md:ml-60 md:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
