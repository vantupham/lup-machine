import type { ReactNode } from 'react';
import type { ProjectType } from '@/storage/schemas/project';

/** Nét vẽ đơn giản, cùng màu chữ, để thẻ loại dự án nhận ra được trong nháy mắt. */
const PATHS: Readonly<Record<ProjectType, ReactNode>> = {
  image: (
    <>
      <rect x="3" y="5" width="22" height="18" rx="2" />
      <circle cx="10" cy="11" r="2.2" />
      <path d="M4 21l7-7 5 5 3-3 5 5" />
    </>
  ),
  audio: <path d="M3 14h3l2-6 3 13 3-17 3 14 2-4h6" />,
  pose: (
    <>
      <circle cx="14" cy="5" r="2.5" />
      <path d="M14 8v9M14 11l-7-4M14 11l7-4M14 17l-5 8M14 17l5 8" />
    </>
  ),
  text: (
    <>
      <path d="M4 6h20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H12l-5 4v-4H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      <path d="M8 11h12M8 15h8" />
    </>
  ),
  tabular: (
    <>
      <rect x="3" y="5" width="22" height="18" rx="2" />
      <path d="M3 11h22M3 17h22M11 5v18M18 5v18" />
    </>
  ),
};

export function ProjectTypeIcon({ type }: { readonly type: ProjectType }) {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[type]}
    </svg>
  );
}
