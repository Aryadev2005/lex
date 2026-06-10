import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Legal Research — LEX' };

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
