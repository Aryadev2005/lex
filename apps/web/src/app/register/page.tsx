import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create account — LEX' };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-indigo-400">LEX</h1>
          <p className="mt-2 text-sm text-slate-400">Legal AI for Indian Lawyers</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <h2 className="mb-6 text-xl font-semibold text-white">Create your account</h2>
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
