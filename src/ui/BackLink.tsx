import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from './icons';

interface BackLinkProps {
  readonly to: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Liên kết quay về trang cha, dùng chung một kiểu ở mọi trang. */
export function BackLink({ to, children, className = '' }: BackLinkProps) {
  return (
    <Link to={to} className={`inline-flex items-center gap-1 text-sm text-primary hover:underline ${className}`}>
      <ArrowLeft />
      {children}
    </Link>
  );
}
