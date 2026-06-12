'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

const NAV_LINKS = [
  { label: 'Research', href: '/dashboard/research' },
  { label: 'Contract', href: '/dashboard/contract' },
  { label: 'Draft', href: '/dashboard/draft' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (hasHydrated && !isAuthed) {
      router.replace('/login');
    }
  }, [isAuthed, hasHydrated, router]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-content-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <nav className="flex items-center justify-between">
          <span className="text-2xl font-black tracking-tight text-indigo-400">LEX</span>
          <div className="flex items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href
                    ? 'text-sm text-indigo-400 font-medium'
                    : 'text-sm text-slate-400 hover:text-white transition-colors'
                }
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
