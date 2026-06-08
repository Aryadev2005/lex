import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in — LEX' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-indigo-400">LEX</h1>
          <p className="mt-2 text-sm text-slate-400">Legal AI for Indian Lawyers</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <h2 className="mb-6 text-xl font-semibold text-white">Sign in to your account</h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
