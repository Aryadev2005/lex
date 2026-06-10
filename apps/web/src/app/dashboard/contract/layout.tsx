import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contract Risk Analysis — LEX' };

export default function ContractLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
