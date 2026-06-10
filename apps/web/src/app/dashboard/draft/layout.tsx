import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Document Drafting — LEX',
};

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
