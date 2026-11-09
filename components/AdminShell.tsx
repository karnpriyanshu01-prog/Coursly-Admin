'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase, isConfigured } from '@/lib/supabase/client';
import type { AdminRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icons';
import { Button, Card, IconButton, Spinner } from './ui';

interface AdminInfo {
  email: string;
  role: AdminRole;
  isFullAdmin: boolean;
}

const AdminContext = createContext<AdminInfo>({ email: '', role: 'editor', isFullAdmin: false });
export const useAdmin = () => useContext(AdminContext);

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Dashboard', icon: 'layout-dashboard' },
  { href: '/courses', label: 'Courses', icon: 'book-open' },
  { href: '/categories', label: 'Categories', icon: 'layout-grid' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

type Status = 'loading' | 'ready' | 'denied' | 'unconfigured';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setStatus('unconfigured');
      return;
    }
    const sb = getSupabase();
    (async () => {
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace('/login');
        return;
      }
      // RLS lets a signed-in user read only their own admin_users row.
      const { data: row } = await sb
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row) {
        setInfo({ email: user.email ?? '', role: 'editor', isFullAdmin: false });
        setStatus('denied');
        return;
      }
      const role = row.role as AdminRole;
      setInfo({ email: user.email ?? '', role, isFullAdmin: role === 'admin' });
      setStatus('ready');
    })();
  }, [router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const signOut = async () => {
    await getSupabase().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const ctx = useMemo(() => info ?? { email: '', role: 'editor' as AdminRole, isFullAdmin: false }, [info]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Spinner size={22} />
      </div>
    );
  }

  if (status === 'unconfigured') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-warm p-6">
        <Card className="max-w-md p-6">
          <h1 className="t-h2">Supabase is not configured</h1>
          <p className="t-body mt-2">
            Copy <code className="rounded bg-paper-warm px-1">.env.example</code> to{' '}
            <code className="rounded bg-paper-warm px-1">.env.local</code>, fill in your project URL and anon
            key, then restart <code className="rounded bg-paper-warm px-1">npm run dev</code>.
          </p>
        </Card>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-warm p-6">
        <Card className="max-w-md p-6">
          <h1 className="t-h2">No admin access</h1>
          <p className="t-body mt-2">
            {info?.email} is signed in, but is not an administrator. Ask the owner to add you to the{' '}
            <code className="rounded bg-paper-warm px-1">admin_users</code> table.
          </p>
          <Button className="mt-5" variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-3 px-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="Coursly" width={36} height={36} className="h-9 w-9 rounded-lg" />
        <div className="leading-tight">
          <div className="text-[16px] font-bold tracking-[-0.25px]">Coursly</div>
          <div className="text-[12px] font-medium text-ink-muted">Admin panel</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors duration-100 ease-in-out',
                active
                  ? 'bg-green-100 font-semibold text-green-700'
                  : 'font-medium text-ink-soft hover:bg-black/5',
              )}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <div className="px-2 pb-2">
          <div className="truncate text-[13px] font-medium text-ink">{info?.email}</div>
          <div className="t-caption capitalize">{info?.role}</div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors duration-100 hover:bg-black/5"
        >
          <Icon name="log-out" size={18} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-screen bg-paper-warm md:flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-paper-soft md:sticky md:top-0 md:block md:h-screen">
          {sidebar}
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Coursly" width={30} height={30} className="h-[30px] w-[30px] rounded-md" />
            <span className="text-[16px] font-bold tracking-[-0.25px]">Coursly Admin</span>
          </Link>
          <IconButton label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={22} />
          </IconButton>
        </header>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-paper-soft shadow-pop">{sidebar}</div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
