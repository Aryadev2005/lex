import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-700 bg-slate-800/50 p-6',
        className,
      )}
    >
      {title && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
