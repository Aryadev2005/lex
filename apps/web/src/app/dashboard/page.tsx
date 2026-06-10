'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface DbStatusResponse {
  connected: boolean;
  count?: number;
  table?: string;
  timestamp?: string;
  error?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const { data: dbStatus, isLoading: dbLoading } = useQuery({
    queryKey: ['db-status'],
    queryFn: () => api.get<DbStatusResponse>('/test/db'),
    refetchInterval: 30_000,
  });

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user.full_name}
          </h1>
          <p className="mt-1 text-slate-400">Here&apos;s your workspace overview.</p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          Sign out
        </Button>
      </div>

      <Card title="Account Details">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wider">Email</dt>
            <dd className="mt-1 text-sm text-white">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wider">Role</dt>
            <dd className="mt-1">
              <span className="inline-flex rounded-full bg-indigo-900/60 px-2.5 py-0.5 text-xs font-medium text-indigo-300 capitalize">
                {user.role.replace('_', ' ')}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wider">Account created</dt>
            <dd className="mt-1 text-sm text-white">
              {new Date(user.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          {user.org_id && (
            <div>
              <dt className="text-xs text-slate-500 uppercase tracking-wider">Organization</dt>
              <dd className="mt-1 text-sm text-white font-mono text-xs">{user.org_id}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card title="System Status">
        {dbLoading ? (
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="text-sm text-slate-400">Checking database connection…</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                dbStatus?.connected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white">
                Database: {dbStatus?.connected ? 'Connected' : 'Disconnected'}
              </p>
              {dbStatus?.connected && dbStatus.count !== undefined && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {dbStatus.count} organization{dbStatus.count !== 1 ? 's' : ''} in system
                </p>
              )}
              {!dbStatus?.connected && dbStatus?.error && (
                <p className="text-xs text-red-400 mt-0.5">{dbStatus.error}</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
